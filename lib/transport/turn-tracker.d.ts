import type { ExternalTurnDelivery } from '../config.ts';
import type { Logger, ReplyTarget } from '../types.ts';
import type { QqInputRegistry } from './qq-input-origin.ts';
/** 本回合的投递计划 */
export interface DeliveryPlan {
    target: ReplyTarget;
    /** 主动推送：不复用被动回复窗口，不走流式 */
    proactive: boolean;
    idleWake?: boolean;
}
/** 按会话解析投递目标。undefined = 不是 QQ 会话，或本回合按策略不投递到 QQ。 */
export interface DeliveryTargetResolver {
    targetFor: (sessionId: string) => ReplyTarget | undefined;
}
/** 会话地址查询的最小契约（SessionManager 实现） */
export interface TurnTrackerManagerLike {
    findBySessionId: (sessionId: string) => {
        replyTarget: ReplyTarget;
    } | undefined;
    deliveryAddress?: (sessionId: string) => ReplyTarget | undefined;
}
export interface TurnTrackerOptions {
    externalTurns: ExternalTurnDelivery;
}
export declare class TurnTracker implements DeliveryTargetResolver {
    private readonly turns;
    private readonly manager;
    private readonly inputs;
    private readonly options;
    private readonly logger;
    constructor(manager: TurnTrackerManagerLike, inputs: QqInputRegistry, options: TurnTrackerOptions, logger: Logger);
    /**
     * turn/start：开启新回合。
     * @returns true 表示确实换了一轮（调用方据此清理上一轮的出站状态）
     */
    begin(sessionId: string, turn: number | undefined): boolean;
    /** user/message：按这一条消息归类，不发送 */
    note(sessionId: string, data: Record<string, unknown>): void;
    /**
     * 事件是否属于当前回合。
     * - 没有回合状态时放行，兼容不带 turn 的旧事件；
     * - turn/end 没有回合号也算没对上，避免迟到的结束清掉新一轮。
     */
    isCurrent(sessionId: string, type: string, turn: number | undefined): boolean;
    /** turn/end：结束回合并释放本回合认领的入站登记 */
    end(sessionId: string): void;
    /**
     * 本回合怎么发。
     * - 不是 QQ 会话 → undefined；
     * - 无回合状态或被动回合 → 沿用会话的 replyTarget（含 msgId）；
     * - 主动回合 → 只保留地址并打 forceProactive；external 回合按策略可能不投递。
     */
    planFor(sessionId: string): DeliveryPlan | undefined;
    targetFor(sessionId: string): ReplyTarget | undefined;
    /** 当前跟踪中的回合数（可观测性/测试用） */
    get activeTurns(): number;
    private allowsExternal;
    private addressOf;
    private release;
}
//# sourceMappingURL=turn-tracker.d.ts.map