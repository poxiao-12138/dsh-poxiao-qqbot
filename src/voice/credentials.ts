/**
 * Breeze 凭证读取。
 *
 * 优先使用插件配置里的 apiKey/voiceId；否则复用 qq-voice-polish 插件保存到
 * ~/.dsh/.credentials.yaml 的 QQ_VOICE_POLISH_BREEZE（{apiKey, voiceId} JSON）。
 * 这样用户只需在 qq-voice-polish 设置页填一次，集成版直接共用。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'js-yaml';
import { parseDocument } from 'yaml';

export interface VoiceCredentials {
  apiKey: string;
  voiceId: string;
}

export function readDeepSeekKey(
  dshHome: string = process.env.DSH_HOME || path.join(os.homedir(), '.dsh'),
): string | null {
  try {
    const file = path.join(dshHome, '.credentials.yaml');
    const document = YAML.load(fs.readFileSync(file, 'utf8')) as
      | { version?: number; refs?: Record<string, unknown> }
      | null;
    const key = document?.refs?.DEEPSEEK_API_KEY;
    return typeof key === 'string' && key.length > 8 ? key : null;
  } catch {
    return null;
  }
}

export function saveVoiceCredentials(
  credentials: VoiceCredentials,
  dshHome: string = process.env.DSH_HOME || path.join(os.homedir(), '.dsh'),
): boolean {
  try {
    const file = path.join(dshHome, '.credentials.yaml');
    const doc = parseDocument(fs.readFileSync(file, 'utf8'));
    doc.setIn(['refs', 'QQ_VOICE_POLISH_BREEZE'], JSON.stringify(credentials));
    const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, doc.toString({ lineWidth: 0 }), { mode: 0o600 });
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

export function readVoiceCredentials(
  dshHome: string = process.env.DSH_HOME || path.join(os.homedir(), '.dsh'),
): VoiceCredentials | null {
  try {
    const file = path.join(dshHome, '.credentials.yaml');
    const stat = fs.statSync(file);
    if (process.platform !== 'win32' && (stat.mode & 0o077)) return null;
    const document = YAML.load(fs.readFileSync(file, 'utf8')) as
      | { version?: number; refs?: Record<string, unknown> }
      | null;
    if (document?.version !== 1) return null;
    const packed = document.refs?.QQ_VOICE_POLISH_BREEZE;
    if (typeof packed !== 'string') return null;
    const pair = JSON.parse(packed) as { apiKey?: unknown; voiceId?: unknown };
    // 不做格式限制：用户自己的 Key/音色 ID 只要非空即可，能否用交给 Breeze 判断
    if (typeof pair.apiKey !== 'string' || pair.apiKey.trim().length === 0 || pair.apiKey.length > 500) return null;
    if (typeof pair.voiceId !== 'string' || pair.voiceId.trim().length === 0 || pair.voiceId.length > 200) return null;
    return { apiKey: pair.apiKey.trim(), voiceId: pair.voiceId.trim() };
  } catch {
    return null;
  }
}
