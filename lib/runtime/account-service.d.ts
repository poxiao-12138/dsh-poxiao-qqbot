import { MemberStore } from './member-store.ts';
import { PairingService } from './pairing-service.ts';
import { type ManualPairResult, type PairChallenge, type PairPurpose, type PairStatusWire } from '../shared/pairing-protocol.ts';
import type { ChatScope, Logger } from '../types.ts';
import type { AccessControlConfig, ImQQBotConfig } from '../config.ts';
/** 可注入依赖（测试与存储替换）；缺省使用基于文件的实现。 */
export interface AccountAccessDeps {
    /**
     * 配对码随机源，缺省为密码学随机。
     * 只在使用默认 PairingService 时生效；同时注入 `pairing` 时会被忽略。
     */
    random?: () => number;
    store?: MemberStore;
    pairing?: PairingService;
}
/**
 * 扫码绑定后自动把绑定者认领为主人（幂等、保留已有资料）。
 */
export declare function claimBoundOwner(appId: string, userOpenid: string | undefined, dataDir?: string): boolean;
export declare class AccountAccessService {
    readonly config: ImQQBotConfig;
    readonly logger: Logger;
    readonly store: MemberStore;
    readonly pairing: PairingService;
    constructor(config: ImQQBotConfig, logger: Logger, deps?: AccountAccessDeps);
    /** Web：为一种名单生成限时配对批次，替换时旧码失效。 */
    issuePairCode(purpose: PairPurpose, previousCode?: string): PairChallenge;
    endPairCode(code: string, purpose: PairPurpose): void;
    /** 读取已认领成员：超管来自 store.owners + memberProfiles；白名单来自 store 的 access。 */
    pairStatus(): PairStatusWire;
    /** 把（openid + 展示资料）写入指定名单（超管 / 私聊白名单 / 群白名单）。返回是否成功。 */
    private applyMember;
    /** 该文本是否是一个进行中的配对码（供"裸 token"拦截判断，不核销）。 */
    isActivePairCode(text: string): boolean;
    /** 由 QQ 侧发起认领（群里/私聊直接发送配对码）：在允许接入的场景认领。 */
    beginClaimFromMessage(scope: ChatScope, peerId: string, code: string, senderId: string, senderName?: string): {
        ok: boolean;
        message: string;
    };
    private claimMember;
    /**
     * Web：手动按 openID 直接添加成员（超管 / 白名单）。允许用户自行输入 openid。
     * 显示昵称留空，待日后其在 QQ 发言或认领时补全。
     */
    addManualMember(purpose: PairPurpose, input: string): ManualPairResult;
    /** Web：修改成员显示昵称（openid 身份不变）。 */
    renameMember(openid: string, nickname: string): {
        ok: boolean;
        message: string;
    };
    /** Web：撤销一个已认领身份（超管 / 白名单）。 */
    revokePair(openid: string, purpose: PairPurpose): {
        ok: boolean;
        message: string;
    };
    private updateMembership;
    /**
     * 把最新 access 写回宿主持有的 config 对象。这是刻意的 HMR 窗口同步：
     * updateProfileConfig 触发宿主重载之前，旧 fiber 仍在服务 QQ 请求，
     * 必须立即看到新名单，否则会按旧名单放行/拒绝。
     */
    private syncConfigAccess;
    currentAccess(): AccessControlConfig;
    commandAccessError(actor?: string): string | undefined;
    isOwner(actor?: string): boolean;
    /**
     * 用于私聊主动联系与角色自我进化的有效主人列表：
     * - 命令白名单（owners）非空时，严格只认 owners；
     * - owners 为空且私聊处于白名单模式、名单恰有 1 人时（典型个人机器人 / 扫码绑定存量用户），
     *   兜底将该唯一私聊账号视为主人，不影响斜杠命令白名单权限。
     */
    effectiveOwnerIds(): string[];
    isEffectiveOwner(actor?: string): boolean;
}
//# sourceMappingURL=account-service.d.ts.map