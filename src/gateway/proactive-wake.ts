import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN_HOME } from '../shared/dirs.ts';

export function logProactiveWake(event: string): void {
  // Test routers simulate delivery and must not produce records in the live log.
  if (process.env.VITEST === 'true') return;
  try {
    mkdirSync(PLUGIN_HOME, { recursive: true, mode: 0o700 });
    appendFileSync(join(PLUGIN_HOME, 'proactive-wake.log'), `[${new Date().toISOString()}] ${event}\n`, { mode: 0o600 });
  } catch { /* 诊断记录不影响对话 */ }
}

const MINUTE = 60_000;

export const PROACTIVE_WAKE_SOURCE = 'im-qqbot.proactive-wake';

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    [PROACTIVE_WAKE_SOURCE]: {
      kind: typeof PROACTIVE_WAKE_SOURCE;
      form: 'notice';
      summary: string;
    };
  }
}
export const PROACTIVE_WAKE_PROMPT = '这是一次定时主动联系，对方没有发来新消息。直接写一句要发给主人的自然私聊消息。能接续最近的话题就接续，没有明确话头就简单打个招呼。这轮不用工具，不编造发现，也不解释唤醒。';

export function proactiveText(text: string): string | undefined {
  const reply = text.trim().replace(/^\[\[主动联系\]\]\s*/u, '');
  return reply === '[[静默]]' ? '来跟你打个招呼。' : reply || undefined;
}

function nextWake(now: number, random: number): number {
  const target = new Date(now + Math.floor((120 + 120 * random) * MINUTE));
  if (target.getHours() < 8) target.setHours(8, 0, 0, 0);
  return target.getTime();
}

/** 每个主人私聊独立检查。连续入站仅更新闲置时间，不重置检查节拍。 */
export class ProactiveWake {
  private readonly peers = new Map<string, { lastIncoming: number; timer?: ReturnType<typeof setTimeout> }>();

  constructor(
    private readonly check: (peer: string, lastIncoming: number) => void | Promise<void>,
    private readonly random = Math.random,
    private readonly report: (event: string) => void = () => {},
  ) {}

  watch(peer: string, markIncoming = true): void {
    const entry = this.peers.get(peer);
    if (entry) {
      if (markIncoming) entry.lastIncoming = Date.now();
      return;
    }
    const state = { lastIncoming: Date.now() };
    this.peers.set(peer, state);
    this.schedule(peer, state);
  }

  isCurrent(peer: string, lastIncoming: number): boolean {
    return this.peers.get(peer)?.lastIncoming === lastIncoming;
  }

  private schedule(peer: string, state: { lastIncoming: number; timer?: ReturnType<typeof setTimeout> }, due = nextWake(Date.now(), this.random())): void {
    const delay = Math.max(0, due - Date.now());
    this.report(`已安排检查 next=${new Date(Date.now() + delay).toISOString()}`);
    state.timer = setTimeout(() => {
      const now = new Date();
      if (now.getHours() < 8) {
        this.schedule(peer, state, now.setHours(8, 0, 0, 0));
        return;
      }
      this.schedule(peer, state);
      void this.check(peer, state.lastIncoming);
    }, delay);
    state.timer.unref?.();
  }

  stop(): void {
    for (const state of this.peers.values()) clearTimeout(state.timer);
    this.peers.clear();
  }
}
