/**
 * QQ 入站登记。
 *
 * followup 进去的 user 消息和桌面输入都是 kind=user，靠 source 区分不开。
 * 宿主契约保证 Message.id 跨所有表示边界保持不变（dsh-llm `Message.id`），
 * 所以入站时登记本插件铸造的消息 id，出站在 user/message 上按 id 认领。
 *
 * - 查询不消费：同一条消息可能被事件重放重复读取；
 * - 正常释放由回合结束驱动（TurnTracker.end → release）；
 * - TTL 与条数上限只是兜底，防止丢失 turn/end 时无界增长。
 */
export interface QqInputRegistryOptions {
    /** 登记存活时长(ms)；缺省 {@link MIN_TTL_MS} */
    ttlMs?: number;
    /** 最多保留的登记条数，超出按登记先后淘汰 */
    maxEntries?: number;
    /** 时钟（测试注入） */
    now?: () => number;
}
/** 按处理超时推导兜底 TTL：排队等待 + 一次完整处理都不应让登记过期 */
export declare function inputOriginTtlMs(processingTimeoutMs: number): number;
export declare class QqInputRegistry {
    private readonly entries;
    private readonly ttlMs;
    private readonly maxEntries;
    private readonly now;
    constructor(options?: QqInputRegistryOptions);
    /** 登记一条本插件入站的消息 id */
    register(messageId: string): void;
    /** 是否为本插件登记过且未过期的消息。不删除登记。 */
    has(messageId: string | undefined): boolean;
    /** 回合结束后释放登记 */
    release(messageId: string): void;
    get size(): number;
    private prune;
    private evictOverflow;
}
//# sourceMappingURL=qq-input-origin.d.ts.map