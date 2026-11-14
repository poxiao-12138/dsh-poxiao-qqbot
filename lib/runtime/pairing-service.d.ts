import { type PairChallenge, type PairClaimResult, type PairPurpose } from '../shared/pairing-protocol.ts';
type Validation = {
    ok: true;
    purpose: PairPurpose;
} | {
    ok: false;
    reason: 'unknown' | 'expired';
};
export declare class PairingService {
    private readonly pending;
    private readonly now;
    private readonly random;
    private readonly stateFile;
    constructor(options?: {
        now?: () => number;
        random?: () => number;
        stateFile?: string;
    });
    /** 生成一个新码（清理过期项；超上限淘汰最旧）。 */
    issue(purpose: PairPurpose, previousCode?: string): PairChallenge;
    /** 验证限时批次；成功不会消耗配对码。 */
    validate(rawCode: string): Validation;
    end(rawCode: string, purpose: PairPurpose): void;
    claimResult(rawCode: string, openid: string): PairClaimResult | undefined;
    /** Existing invitations cannot undo a later removal; fresh invitations start without this fence. */
    revokeIdentity(purpose: PairPurpose, openid: string): void;
    isRevoked(rawCode: string, openid: string): boolean;
    recordResult(rawCode: string, member: PairClaimResult): void;
    hasActiveCode(rawCode: string): boolean;
    /** 展示进行中的码（未过期的）。 */
    listChallenges(): PairChallenge[];
    private challenge;
    private refresh;
    private save;
    private sweep;
}
export {};
//# sourceMappingURL=pairing-service.d.ts.map