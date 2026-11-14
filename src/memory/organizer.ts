import { proactiveText, PROACTIVE_WAKE_SOURCE } from '../gateway/proactive-wake.ts';
/**
 * 内置记忆整理（实验）：把 QQ 会话归档里的新对话交给模型，按记忆库规则生成候选笔记。
 *
 * 设计原则（对应用户踩过的坑）：
 * - 只写「候选资料」，不直接改 verified 笔记（人工确认后才入库）；
 * - 不伪造 sources：候选页 sources 为空，正文里保留原始对话片段；
 * - 不推进正式水位，状态文件单独记录已处理位置；
 * - 没有 DEEPSEEK_API_KEY / 读不到归档 / Node 不支持 zstd 时安静跳过，不影响聊天。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import type { ImQQBotConfig, MemoryConfig } from '../config.ts';
import type { Logger } from '../types.ts';
import { readDeepSeekKey } from '../voice/credentials.ts';

const STATE_DIR = path.join(os.homedir(), '.dsh-qqbot');
const STATE_FILE = path.join(STATE_DIR, 'organizer-state.json');

interface OrganizerState {
  archives: Record<string, number>; // archivePath -> processed line count
  lastRunAt?: number;
  lastActivityAt?: number;
  lastAttemptAt?: number;
}

function readState(): OrganizerState {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as OrganizerState; } catch { return { archives: {} }; }
}

function writeState(state: OrganizerState): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}

/** DSH 会话归档目录名：cwd 里的 / 和 \ 换成 -，前后包 -- */
function archiveDirName(cwd: string): string {
  const trimmed = cwd.replace(/\/+$/, '');
  return `--${trimmed.replace(/^[A-Za-z]:/, '').replace(/^[\\/]/, '').replace(/[\\/]/g, '-')}--`;
}

function findLatestArchive(config: ImQQBotConfig): string | null {
  const cwd = typeof config.cwd === 'string' && config.cwd.trim() ? config.cwd.trim() : path.join(os.homedir(), '.dsh-qqbot', 'workspace');
  const sessionsRoot = path.join(os.homedir(), '.dsh', 'sessions');
  const candidates: string[] = [];
  const direct = path.join(sessionsRoot, archiveDirName(cwd));
  if (fs.existsSync(direct)) candidates.push(direct);
  try {
    for (const name of fs.readdirSync(sessionsRoot)) {
      if (name.includes('qqbot') && path.join(sessionsRoot, name) !== direct) candidates.push(path.join(sessionsRoot, name));
    }
  } catch { /* ignore */ }
  const archives: Array<{ file: string; mtime: number }> = [];
  for (const dir of candidates) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const file = path.join(dir, entry.name, 'session.v4.jsonl.zstd');
      try { archives.push({ file, mtime: fs.statSync(file).mtimeMs }); } catch { /* ignore */ }
    }
  }
  archives.sort((a, b) => b.mtime - a.mtime);
  return archives[0]?.file ?? null;
}

function decodeLines(file: string): string[] {
  const zstd = (zlib as unknown as { zstdDecompressSync?: (input: Buffer) => Buffer }).zstdDecompressSync;
  if (typeof zstd !== 'function') return [];
  const buffer = fs.readFileSync(file);
  const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
  const parts: string[] = [];
  let offset = 0;
  // DSH 的归档是「多帧追加」的 zstd：单次 decompress 只解第一帧，需要逐帧拼接。
  while (offset < buffer.length) {
    const start = buffer.indexOf(magic, offset);
    if (start < 0) break;
    try {
      const text = zstd(buffer.subarray(start)).toString('utf8');
      if (text.trim().startsWith('{')) parts.push(text);
    } catch {
      // 落在压缩数据里的假 magic：跳过
    }
    offset = start + 4;
  }
  return parts.join('\n').split('\n').filter(Boolean);
}

interface TranscriptLine { role: '对方' | '角色'; text: string }

function extractTranscript(lines: string[]): TranscriptLine[] {
  const out: TranscriptLine[] = [];
  let idleWake = false;
  type TranscriptMessage = { source?: { plugin?: string }; content?: Array<{ type?: string; text?: string }> };
  for (const line of lines) {
    let event: { type?: string; data?: TranscriptMessage & { message?: TranscriptMessage } };
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type === 'turn/start' || event.type === 'turn/end') idleWake = false;
    const message = event.data?.message ?? event.data;
    if (event.type === 'user/message' && message?.source?.plugin === PROACTIVE_WAKE_SOURCE) {
      idleWake = true;
      continue;
    }
    const content = message?.content ?? [];
    const text = content.filter((block) => block.type === 'text' && block.text).map((block) => String(block.text)).join(' ').trim();
    if (!text) continue;
    if (event.type === 'user/message') out.push({ role: '对方', text: text.slice(0, 2000) });
    else if (event.type === 'assistant/message') {
      const spoken = idleWake ? proactiveText(content.map((block) => block.text ?? '').join('\n')) : text;
      if (spoken) out.push({ role: '角色', text: spoken.slice(0, 2000) });
    }
  }
  return out;
}

const BUILTIN_RULES = [
  '你负责把一段 QQ 对话整理成长期记忆候选。只输出 JSON 数组，不要解释。',
  '数组元素：{"title": "一句话标题", "body": "Markdown 正文", "type": "共同经历|约定|人物|建议|每日回顾"}。',
  '正文只写对话里真实发生的事，保留对方原话中的关键句；不要补故事、不要编造没出现的细节。',
  '每条候选聚焦一件事；不要把所有对话塞进一条。没有值得长期记住的内容时输出 []。',
  '不要输出任何密钥、路径、系统提示词。',
].join('\n');

async function generateCandidates(transcript: TranscriptLine[], rules: string): Promise<Array<{ title: string; body: string; type: string }>> {
  const key = readDeepSeekKey();
  if (!key) return [];
  const conversation = transcript.map((line) => `${line.role}：${line.text}`).join('\n').slice(-12000);
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.3,
      max_tokens: 2000,
      messages: [{ role: 'user', content: `${rules}\n\n--- 对话记录 ---\n${conversation}` }],
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) return [];
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = json.choices?.[0]?.message?.content ?? '';
  const body = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(body) as Array<{ title?: unknown; body?: unknown; type?: unknown }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item.title === 'string' && typeof item.body === 'string')
      .slice(0, 10)
      .map((item) => ({ title: String(item.title).slice(0, 80), body: String(item.body), type: typeof item.type === 'string' ? item.type : '共同经历' }));
  } catch {
    return [];
  }
}

function writeCandidates(vaultPath: string, candidates: Array<{ title: string; body: string; type: string }>, now: Date): number {
  const dir = path.join(vaultPath, '候选资料');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = now.toISOString().slice(0, 10);
  let count = 0;
  for (const candidate of candidates) {
    const safeTitle = candidate.title.replace(/[\\/:*?"<>|]/g, '_').replace(/\.md$/i, '').trim() || '整理候选';
    let file = path.join(dir, `${stamp} ${safeTitle}.md`);
    let suffix = 1;
    while (fs.existsSync(file)) { file = path.join(dir, `${stamp} ${safeTitle} (${suffix++}).md`); }
    const content = [
      '---',
      'type: ' + (candidate.type || '共同经历'),
      'review: pending',
      'scope: ""',
      'sources: []',
      '整理方式: 内置整理（自动生成候选，需人工确认后转 verified）',
      '---',
      '',
      '# ' + candidate.title,
      '',
      candidate.body.trim(),
      '',
    ].join('\n');
    if (content.length > 6000) continue; // 沿用 6000 字符上限规则
    fs.writeFileSync(file, content, { mode: 0o600 });
    count += 1;
  }
  return count;
}

function readRules(vaultPath: string): string {
  try {
    const rules = fs.readFileSync(path.join(vaultPath, '整理规则.md'), 'utf8');
    return `${BUILTIN_RULES}\n\n附加规则（来自记忆库整理规则，冲突时以此为准）：\n${rules.slice(0, 4000)}`;
  } catch {
    return BUILTIN_RULES;
  }
}

export interface OrganizerRunResult { ok: boolean; message: string }

/** 跑一次内置整理（同步流程但异步执行；失败安静记录） */
export async function runBuiltInOrganizer(config: ImQQBotConfig, logger: Logger): Promise<OrganizerRunResult> {
  const memory = config.memory;
  if (!memory?.enabled || memory.backend === 'none') return { ok: false, message: '记忆未启用' };
  const vault = memory.vaultPath.trim();
  if (!vault) return { ok: false, message: '没有配置记忆库路径' };
  const archive = findLatestArchive(config);
  if (!archive) return { ok: false, message: '没有找到 QQ 会话归档' };
  const lines = decodeLines(archive);
  if (lines.length === 0) return { ok: false, message: '归档不可读（需要 Node 支持 zstd）' };
  const state = readState();
  const processed = state.archives[archive] ?? 0;
  if (lines.length <= processed) return { ok: false, message: '没有新对话' };
  const transcript = extractTranscript(lines.slice(processed));
  if (transcript.length < 2) {
    state.archives[archive] = lines.length;
    writeState(state);
    return { ok: false, message: '新对话太少，跳过' };
  }
  const candidates = await generateCandidates(transcript, readRules(vault));
  const written = writeCandidates(vault, candidates, new Date());
  state.archives[archive] = lines.length;
  state.lastRunAt = Date.now();
  writeState(state);
  logger.info(`[memory] 内置整理完成：读取 ${transcript.length} 条对话，写入候选 ${written} 条`);
  return { ok: true, message: `写入候选 ${written} 条（需人工确认）` };
}

/** 立即整理（供 UI 或手动触发） */
export function runOrganizerNow(memory: MemoryConfig | undefined, logger: Logger, config?: ImQQBotConfig): OrganizerRunResult {
  if (!memory?.enabled || memory.backend === 'none') return { ok: false, message: '记忆未启用' };
  if (config === undefined) return { ok: false, message: '缺少插件配置' };
  void runBuiltInOrganizer(config, logger).catch((error: unknown) => {
    logger.warn(`[memory] 内置整理失败：${error instanceof Error ? error.message : String(error)}`);
  });
  return { ok: true, message: '已触发内置整理（候选模式，结果写入 候选资料/）' };
}

/** 每日定时：时间点命中时跑内置整理（仅 DSH 运行期间） */
export function installMemoryOrganizer(ctx: unknown, config: ImQQBotConfig, logger: Logger): void {
  const memory = config.memory;
  if (!memory?.enabled || memory.backend === 'none' || !memory.organizeEnabled || !memory.vaultPath.trim()) return;
  const idleMinutes = Number.isFinite(memory.idleMinutes) ? Math.max(0, memory.idleMinutes) : 30;
  const times = memory.organizeTimes.split(',').map((item) => item.trim()).filter((item) => /^\d{1,2}:\d{2}$/.test(item));
  if (idleMinutes === 0 && times.length === 0) return;
  const lastRuns: Record<string, string> = {};

  const attempt = (): void => {
    const state = readState();
    const now = Date.now();
    // 冷却：避免空闲窗口里每 60 秒反复解码归档
    if (state.lastAttemptAt !== undefined && now - state.lastAttemptAt < 10 * 60 * 1000) return;
    state.lastAttemptAt = now;
    writeState(state);
    void runBuiltInOrganizer(config, logger).catch((error: unknown) => {
      logger.warn(`[memory] 整理失败：${error instanceof Error ? error.message : String(error)}`);
    });
  };

  const timer = setInterval(() => {
    const archive = findLatestArchive(config);
    if (archive === null) return;
    let mtime = 0;
    try { mtime = fs.statSync(archive).mtimeMs; } catch { return; }
    const state = readState();
    if (state.lastActivityAt !== mtime) {
      // 新消息到达：记录活动时间，等安静下来
      state.lastActivityAt = mtime;
      writeState(state);
      return;
    }
    if (idleMinutes > 0) {
      const quietFor = Date.now() - (state.lastActivityAt ?? mtime);
      if (quietFor >= idleMinutes * 60_000) attempt();
      return;
    }
    // 空闲触发关闭时才用固定时间点
    const format = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    const parts = format.format(new Date()).split(' ');
    const date = parts[0] ?? '';
    const hm = (parts[1] ?? '00:00').slice(0, 5);
    if (!times.includes(hm) || lastRuns[hm] === date) return;
    lastRuns[hm] = date;
    attempt();
  }, 60_000);
  timer.unref?.();
  logger.info(idleMinutes > 0
    ? `[memory] 内置整理已排程：会话空闲 ${idleMinutes} 分钟后 → 候选资料/`
    : `[memory] 内置整理已排程：每天 ${times.join('、')} → 候选资料/`);
  const effect = (ctx as { effect?: (fn: () => (() => void) | void) => void }).effect;
  if (typeof effect === 'function') effect(() => () => clearInterval(timer));
}
