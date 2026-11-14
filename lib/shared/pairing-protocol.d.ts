/**
 * 配对码认领协议 —— Web 与 QQ 两端共享的契约。
 *
 * 背景：官方 QQ 机器人 API 只给 openid（AppID 维度、匿名、群/私两套），用户看不到也拿不到。
 * Web 生成限时配对码，允许多人或多群连续认领同一用途的白名单：
 *   Web 生成码 → 用户在 QQ 直接发送该码 → 机器人把该消息的 openid 记为目标身份。
 *
 * 本模块只含类型 + 常量 + 纯函数（码生成/校验格式），零 node 依赖，
 * 客户端 bundle 会内联。运行期状态（谁生成了哪个码、TTL、是否已用）由配对服务持有。
 */
/** Web 生成配对码 */
export declare const PAIR_ISSUE_PATH = "/qqbot/im-qqbot/pair/issue";
/** Web 关闭添加窗口或替换配对码时停止该批次。 */
export declare const PAIR_END_PATH = "/qqbot/im-qqbot/pair/end";
/** Web 查询认领状态（进行中的码 + 已认领成员） */
export declare const PAIR_STATUS_PATH = "/qqbot/im-qqbot/pair/status";
/** Web 撤销/移除一个已认领成员 */
export declare const PAIR_REVOKE_PATH = "/qqbot/im-qqbot/pair/revoke";
/** Web 手动按 openID 直接添加成员（用户自行输入 openid） */
export declare const PAIR_MANUAL_PATH = "/qqbot/im-qqbot/pair/manual";
/** Web 修改成员昵称 */
export declare const PAIR_RENAME_PATH = "/qqbot/im-qqbot/pair/rename";
/** 认领目标用途：决定把 openid 记到哪一类名单。 */
export type PairPurpose = 'owner' | 'allow-c2c' | 'allow-group';
export declare const PAIR_PURPOSE_LABEL: Record<PairPurpose, string>;
/** 一个进行中的配对码（Web 侧展示 + 轮询）。 */
export interface PairChallenge {
    readonly code: string;
    readonly purpose: PairPurpose;
    /** 过期时间戳（毫秒）。 */
    readonly expiresAt: number;
    readonly createdAt: number;
    /** 只记录服务端已确认的结果；同一身份在一个批次中只出现一次。 */
    readonly claims: PairClaimResult[];
}
/** 已认领的成员（用于页面展示和导出；openid 保留完整值）。 */
export interface ClaimedMember {
    readonly openid: string;
    readonly nickname: string;
    /** 'group' | 'c2c' */
    readonly scene: 'group' | 'c2c';
    /** 目标会话名（群名/私聊对象），便于辨认。 */
    readonly sceneName: string;
    readonly claimedAt: number;
}
export interface PairClaimResult extends ClaimedMember {
    readonly state: 'added' | 'existing' | 'revoked';
}
export interface ManualPairResult {
    readonly ok: boolean;
    readonly message: string;
    readonly added: number;
    readonly results: PairClaimResult[];
    readonly errors: Array<{
        input: string;
        message: string;
    }>;
}
/** Web 端读取的完整配对状态。 */
export interface PairStatusWire {
    readonly challenges: PairChallenge[];
    readonly owners: ClaimedMember[];
    readonly allowC2c: ClaimedMember[];
    readonly allowGroup: ClaimedMember[];
}
export declare function generatePairCode(random?: () => number): string;
/** 归一化用户输入的码（大小写、空格、连字符不影响）。 */
export declare function normalizePairCode(raw: string): string;
/** openid 尾号展示（保留后 4 位，其余打码）。 */
export declare function openidTail(openid: string): string;
type WhitelistEntry = {
    input: string;
    openid: string;
    nickname: string;
} | ManualPairResult['errors'][number];
export declare function formatWhitelistEntry(openid: string, nickname: string): string;
export declare function parseWhitelistEntries(text: string): WhitelistEntry[];
export {};
//# sourceMappingURL=pairing-protocol.d.ts.map