/** 固定窗口从首条消息开始计时，连续发言也不会无限推迟回复。 */
export class WakeBatcher<T> {
  private readonly pending = new Map<string, { messages: T[]; timer: ReturnType<typeof setTimeout> }>();

  constructor(private readonly delay: number, private readonly dispatch: (messages: T[]) => Promise<void>) {}

  add(key: string, message: T): void {
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

  stop(): void {
    for (const { timer } of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
  }
}
