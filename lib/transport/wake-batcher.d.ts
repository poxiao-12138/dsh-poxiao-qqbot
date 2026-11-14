/** 固定窗口从首条消息开始计时，连续发言也不会无限推迟回复。 */
export declare class WakeBatcher<T> {
    private readonly delay;
    private readonly dispatch;
    private readonly pending;
    constructor(delay: number, dispatch: (messages: T[]) => Promise<void>);
    add(key: string, message: T): void;
    stop(): void;
}
//# sourceMappingURL=wake-batcher.d.ts.map