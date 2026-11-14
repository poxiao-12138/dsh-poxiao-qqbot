/**
 * 长期记忆：Obsidian 库检索。
 *
 * 沿用大肥鱼那套约定：
 * - 只把 review: verified 的笔记当可召回事实（verifiedOnly 可关）；
 * - 笔记超过 6000 字符不进召回（整篇跳过，避免上下文爆炸）；
 * - scope 匹配（空 = 不限；笔记 scope 为 all/缺失时视为通用）；
 * - 索引类文件（图片索引/原文索引/首页/整理规则等）跳过。
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'js-yaml';
import type { MemoryConfig } from '../config.ts';

export interface MemoryHit {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

interface Note {
  path: string;
  title: string;
  body: string;
  scope?: string;
}

const SKIP_NAME = /(索引|首页|整理规则|整理进度|欢迎|记忆字段说明|\.icloud)/;
const MAX_NOTE_CHARS = 6000;
const MAX_FILES = 2000;

function parseFrontmatter(text: string): { data: Record<string, unknown>; body: string } {
  if (!text.startsWith('---')) return { data: {}, body: text };
  const end = text.indexOf('\n---', 3);
  if (end < 0) return { data: {}, body: text };
  const raw = text.slice(3, end).trim();
  try {
    const data = YAML.load(raw) as Record<string, unknown> | null;
    return { data: data ?? {}, body: text.slice(text.indexOf('\n', end + 4) + 1) };
  } catch {
    return { data: {}, body: text.slice(text.indexOf('\n', end + 4) + 1) };
  }
}

function collectMarkdown(dir: string, out: string[], depth = 0): void {
  if (out.length >= MAX_FILES || depth > 6) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.obsidian' || entry.name === 'node_modules') continue;
      collectMarkdown(full, out, depth + 1);
    } else if (entry.isFile() && entry.name.endsWith('.md') && !SKIP_NAME.test(entry.name)) {
      out.push(full);
    }
  }
}

function loadNotes(config: MemoryConfig): Note[] {
  const vault = config.vaultPath.trim();
  if (!vault || !fs.existsSync(vault)) return [];
  const files: string[] = [];
  collectMarkdown(vault, files);
  const notes: Note[] = [];
  for (const file of files) {
    let text: string;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (text.length > MAX_NOTE_CHARS) continue;
    const { data, body } = parseFrontmatter(text);
    const review = data.review;
    if (config.verifiedOnly && review !== 'verified') continue;
    const scope = typeof data.scope === 'string' ? data.scope : undefined;
    if (config.scope && scope && scope !== 'all') {
      const wanted = config.scope;
      const matched = scope === wanted || (wanted.endsWith(':') && scope.startsWith(wanted));
      if (!matched) continue;
    }
    const heading = /^#\s+(.+)$/m.exec(body);
    notes.push({
      path: path.relative(vault, file),
      title: heading?.[1]?.trim() ?? path.basename(file, '.md'),
      body,
      scope,
    });
  }
  return notes;
}

/** 中文按 2-gram、英文按单词切成检索词 */
export function tokenize(query: string): string[] {
  const terms = new Set<string>();
  for (const word of query.toLowerCase().split(/[\s,，。！？、；:：!?;()[\]{}"'“”‘’]+/)) {
    if (!word) continue;
    if (/^[\x00-\x7f]+$/.test(word)) {
      if (word.length >= 2) terms.add(word);
      continue;
    }
    for (let i = 0; i < word.length - 1; i += 1) terms.add(word.slice(i, i + 2));
    if (word.length === 1) terms.add(word);
  }
  return [...terms].slice(0, 24);
}

function snippetAround(body: string, terms: string[]): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  let at = -1;
  for (const term of terms) {
    const index = flat.toLowerCase().indexOf(term);
    if (index >= 0 && (at < 0 || index < at)) at = index;
  }
  if (at < 0) return flat.slice(0, 200);
  const start = Math.max(0, at - 80);
  return `${start > 0 ? '…' : ''}${flat.slice(start, start + 220)}${start + 220 < flat.length ? '…' : ''}`;
}

export function searchMemory(config: MemoryConfig, query: string): { results: MemoryHit[]; scanned: number } {
  const terms = tokenize(query);
  if (terms.length === 0) return { results: [], scanned: 0 };
  const notes = loadNotes(config);
  const scored: Array<MemoryHit & { body: string }> = [];
  for (const note of notes) {
    const haystack = `${note.title}\n${note.body}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      const inTitle = note.title.toLowerCase().includes(term) ? 2 : 0;
      score += inTitle;
      let index = haystack.indexOf(term);
      while (index >= 0) {
        score += 1;
        index = haystack.indexOf(term, index + term.length);
      }
    }
    if (score > 0) scored.push({ path: note.path, title: note.title, snippet: snippetAround(note.body, terms), score, body: note.body });
  }
  scored.sort((a, b) => b.score - a.score);
  const results: MemoryHit[] = [];
  let used = 0;
  for (const hit of scored) {
    if (results.length >= Math.max(1, config.topK)) break;
    if (used + hit.snippet.length > config.maxChars) continue;
    used += hit.snippet.length;
    results.push({ path: hit.path, title: hit.title, snippet: hit.snippet, score: hit.score });
  }
  return { results, scanned: notes.length };
}
