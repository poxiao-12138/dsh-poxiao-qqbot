const MINUTE = 60_000;
export const PROACTIVE_WAKE_SOURCE = 'im-qqbot.proactive-wake';
export const PROACTIVE_WAKE_PROMPT = '这是一次私聊主动联系机会，对方没有发来新消息。仅在你有具体、自然、值得此刻分享或接续的内容时，输出 [[主动联系]] 后另起一行写要发的消息。尊重对方想休息或结束的意思。没有合适的话就只输出 [[静默]]。这轮不用工具，不编造发现，不发例行问候，也不解释唤醒。';
export function proactiveProbability(idleMs, hour, recentReplies = 0, justReplied = false) {
    if (idleMs < 15 * MINUTE)
        return 0;
    let probability = 0.3;
    if (justReplied)
        probability *= 0.5;
    if (hour >= 23 || hour < 8)
        probability *= 0.3;
    if (recentReplies >= 5)
        probability *= 0.3;
    return probability;
}
export function proactiveText(text) {
    return /^\[\[主动联系\]\][ \t]*\r?\n([\s\S]+)$/u.exec(text.trim())?.[1]?.trim() || undefined;
}
/** 每个主人私聊独立检查。连续入站仅更新闲置时间，不重置检查节拍。 */
export class ProactiveWake {
    check;
    random;
    peers = new Map();
    constructor(check, random = Math.random) {
        this.check = check;
        this.random = random;
    }
    watch(peer) {
        const entry = this.peers.get(peer);
        if (entry) {
            entry.lastIncoming = Date.now();
            return;
        }
        const state = { lastIncoming: Date.now() };
        this.peers.set(peer, state);
        this.schedule(peer, state);
    }
    isCurrent(peer, lastIncoming) {
        return this.peers.get(peer)?.lastIncoming === lastIncoming;
    }
    schedule(peer, state) {
        const delay = Math.floor((30 + 60 * this.random()) * MINUTE);
        state.timer = setTimeout(() => {
            this.schedule(peer, state);
            void this.check(peer, state.lastIncoming);
        }, delay);
        state.timer.unref?.();
    }
    stop() {
        for (const state of this.peers.values())
            clearTimeout(state.timer);
        this.peers.clear();
    }
}
//# sourceMappingURL=proactive-wake.js.map