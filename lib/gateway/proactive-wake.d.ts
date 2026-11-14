export declare const PROACTIVE_WAKE_SOURCE = "im-qqbot.proactive-wake";
export declare const PROACTIVE_WAKE_PROMPT = "\u8FD9\u662F\u4E00\u6B21\u79C1\u804A\u4E3B\u52A8\u8054\u7CFB\u673A\u4F1A\uFF0C\u5BF9\u65B9\u6CA1\u6709\u53D1\u6765\u65B0\u6D88\u606F\u3002\u4EC5\u5728\u4F60\u6709\u5177\u4F53\u3001\u81EA\u7136\u3001\u503C\u5F97\u6B64\u523B\u5206\u4EAB\u6216\u63A5\u7EED\u7684\u5185\u5BB9\u65F6\uFF0C\u8F93\u51FA [[\u4E3B\u52A8\u8054\u7CFB]] \u540E\u53E6\u8D77\u4E00\u884C\u5199\u8981\u53D1\u7684\u6D88\u606F\u3002\u5C0A\u91CD\u5BF9\u65B9\u60F3\u4F11\u606F\u6216\u7ED3\u675F\u7684\u610F\u601D\u3002\u6CA1\u6709\u5408\u9002\u7684\u8BDD\u5C31\u53EA\u8F93\u51FA [[\u9759\u9ED8]]\u3002\u8FD9\u8F6E\u4E0D\u7528\u5DE5\u5177\uFF0C\u4E0D\u7F16\u9020\u53D1\u73B0\uFF0C\u4E0D\u53D1\u4F8B\u884C\u95EE\u5019\uFF0C\u4E5F\u4E0D\u89E3\u91CA\u5524\u9192\u3002";
export declare function proactiveProbability(idleMs: number, hour: number, recentReplies?: number, justReplied?: boolean): number;
export declare function proactiveText(text: string): string | undefined;
/** 每个主人私聊独立检查。连续入站仅更新闲置时间，不重置检查节拍。 */
export declare class ProactiveWake {
    private readonly check;
    private readonly random;
    private readonly peers;
    constructor(check: (peer: string, lastIncoming: number) => void | Promise<void>, random?: () => number);
    watch(peer: string): void;
    isCurrent(peer: string, lastIncoming: number): boolean;
    private schedule;
    stop(): void;
}
//# sourceMappingURL=proactive-wake.d.ts.map