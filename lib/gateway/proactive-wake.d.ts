export declare function logProactiveWake(event: string): void;
export declare const PROACTIVE_WAKE_SOURCE = "im-qqbot.proactive-wake";
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        [PROACTIVE_WAKE_SOURCE]: {
            kind: typeof PROACTIVE_WAKE_SOURCE;
            form: 'notice';
            summary: string;
        };
    }
}
export declare const PROACTIVE_WAKE_PROMPT = "\u8FD9\u662F\u4E00\u6B21\u5B9A\u65F6\u4E3B\u52A8\u8054\u7CFB\uFF0C\u5BF9\u65B9\u6CA1\u6709\u53D1\u6765\u65B0\u6D88\u606F\u3002\u50CF\u95F2\u7740\u6CA1\u4E8B\u7A81\u7136\u60F3\u8D77\u4ED6\u4E00\u6837\uFF0C\u53D1\u4E00\u53E5\u81EA\u7136\u7684\u79C1\u804A\uFF1A\u53EF\u4EE5\u5206\u4EAB\u4E00\u4E2A\u81EA\u5DF1\u7684\u5C0F\u5FF5\u5934\u3001\u5410\u69FD\u4E00\u4EF6\u5C0F\u4E8B\u3001\u63A5\u7EED\u4E4B\u524D\u804A\u5230\u4E00\u534A\u7684\u6709\u8DA3\u8BDD\u9898\uFF0C\u6216\u8005\u8F7B\u5FEB\u5730\u6492\u4E2A\u5A07\u3002\u4E0D\u8981\u53D1\u201C\u2026\u2026\u4E86\u6CA1\u201D\u201C\u5403\u996D\u4E86\u5417\u201D\u201C\u4E0B\u73ED\u4E86\u5417\u201D\u201C\u8FDB\u5EA6\u600E\u4E48\u6837\u201D\u8FD9\u7C7B\u8003\u52E4\u6253\u5361\u5F0F\u95EE\u5019\u3002\u8FD9\u8F6E\u4E0D\u7528\u5DE5\u5177\uFF0C\u4E0D\u7F16\u9020\u53D1\u73B0\uFF0C\u4E5F\u4E0D\u89E3\u91CA\u5524\u9192\u3002";
export declare function proactiveText(text: string): string | undefined;
/** 每个主人私聊独立检查。连续入站仅更新闲置时间，不重置检查节拍。 */
export declare class ProactiveWake {
    private readonly check;
    private readonly random;
    private readonly report;
    private readonly peers;
    constructor(check: (peer: string, lastIncoming: number) => void | Promise<void>, random?: () => number, report?: (event: string) => void);
    watch(peer: string, markIncoming?: boolean): void;
    isCurrent(peer: string, lastIncoming: number): boolean;
    private schedule;
    stop(): void;
}
//# sourceMappingURL=proactive-wake.d.ts.map