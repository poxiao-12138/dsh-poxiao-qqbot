/** 固定窗口从首条消息开始计时，连续发言也不会无限推迟回复。 */
export class WakeBatcher {
    delay;
    dispatch;
    pending = new Map();
    constructor(delay, dispatch) {
        this.delay = delay;
        this.dispatch = dispatch;
    }
    add(key, message) {
        const batch = this.pending.get(key);
        if (batch) {
            batch.messages.push(message);
            return;
        }
        const messages = [message];
        const timer = setTimeout(() => {
            this.pending.delete(key);
            void this.dispatch(messages);
        }, this.delay);
        this.pending.set(key, { messages, timer });
    }
    stop() {
        for (const { timer } of this.pending.values())
            clearTimeout(timer);
        this.pending.clear();
    }
}
//# sourceMappingURL=wake-batcher.js.map