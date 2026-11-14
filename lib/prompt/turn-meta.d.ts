/**
 * 每轮运行事实（来源/是否@/发送者/相对时间/未读水位）——作为 runtime context（user 快照）注入，
 * 不混入用户正文。相对时间用 at/ago，避免模型把沉睡后的旧消息当实时。
 */
import type { QQScope } from './scope.ts';
export declare const TURN_META_CONTEXT_NAME = "qqbot:turn-meta";
export declare const TURN_META_ORDER = 100;
export interface TurnMeta {
    scope: QQScope;
    /** 发送者展示名。 */
    senderName?: string;
    /** 发送者 QQ openid/号（群聊 @ 时一并给模型，便于称呼与区分）。 */
    senderId?: string;
    /** 群聊是否 @ 了机器人。 */
    mentioned?: boolean;
    /** 本轮消息时间（epoch ms）；私聊/群聊均可有。 */
    at?: number;
    /** "现在"（epoch ms），用于计算 ago。 */
    now?: number;
    /** 群聊未读/待处理消息数（可选）。 */
    unread?: number;
}
/** 相对时间：历史或未知返回空串，刚刚/近未来返回"刚刚"，否则 N 秒/分钟/小时/天前。 */
export declare function relTime(at: number | undefined, now: number | undefined): string;
/** 消息发出时刻的本地时间（HH:mm），仅在有 at 时给出。 */
export declare function clockOf(at: number | undefined): string;
/** 生成本轮元信息文本；无有效信息时返回空串（空 section 会被丢弃）。 */
export declare function turnMetaText(meta: TurnMeta): string;
//# sourceMappingURL=turn-meta.d.ts.map