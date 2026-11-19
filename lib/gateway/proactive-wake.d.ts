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
export declare const PROACTIVE_WAKE_PROMPT = "\u8FD9\u662F\u4E00\u6B21\u5B9A\u65F6\u4E3B\u52A8\u8054\u7CFB\uFF0C\u5BF9\u65B9\u6CA1\u6709\u53D1\u6765\u65B0\u6D88\u606F\u3002\u76F4\u63A5\u5199\u4E00\u53E5\u8981\u53D1\u7ED9\u4E3B\u4EBA\u7684\u81EA\u7136\u79C1\u804A\u6D88\u606F\u3002\u80FD\u63A5\u7EED\u6700\u8FD1\u7684\u8BDD\u9898\u5C31\u63A5\u7EED\uFF0C\u6CA1\u6709\u660E\u786E\u8BDD\u5934\u5C31\u7B80\u5355\u6253\u4E2A\u62DB\u547C\u3002\u8FD9\u8F6E\u4E0D\u7528\u5DE5\u5177\uFF0C\u4E0D\u7F16\u9020\u53D1\u73B0\uFF0C\u4E5F\u4E0D\u89E3\u91CA\u5524\u9192\u3002";
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