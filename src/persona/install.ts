/**
 * 安装时兜底：工作区没有 AGENTS.md 就写一份默认角色卡，
 * 保证全新用户装完就能直接聊天，而不是先面对一个空人设。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ImQQBotConfig } from '../config.ts';
import type { Logger } from '../types.ts';
import { DEFAULT_PERSONA } from './templates.ts';

export function ensureDefaultPersona(config: ImQQBotConfig, logger: Logger): void {
  const workspace = typeof config.cwd === 'string' && config.cwd.trim()
    ? config.cwd
    : path.join(os.homedir(), '.dsh-qqbot', 'workspace');
  const file = path.join(workspace, 'AGENTS.md');
  try {
    if (fs.existsSync(file)) return;
    fs.mkdirSync(workspace, { recursive: true });
    fs.writeFileSync(file, DEFAULT_PERSONA, { mode: 0o600 });
    logger.info(`[persona] 已写入默认角色卡：${file}（可在设置页「人设」里改）`);
  } catch (error) {
    logger.warn(`[persona] 写入默认角色卡失败：${error instanceof Error ? error.message : String(error)}`);
  }
}
