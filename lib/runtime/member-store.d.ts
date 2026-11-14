import type { ClaimedMember } from '../shared/pairing-protocol.ts';
type MemberProfile = Omit<ClaimedMember, 'openid'>;
/** Account identities only. Native Session preferences and QQ message files remain untouched. */
export declare class MemberStore {
    private readonly dataDir;
    private readonly appId;
    private readonly path;
    private readonly legacyPath;
    constructor(dataDir: string, appId: string, legacyOwners?: () => readonly string[]);
    ownerIds(): string[];
    memberProfiles(): Record<string, MemberProfile>;
    setMemberProfile(openid: string, profile: MemberProfile): void;
    setMemberNickname(openid: string, nickname: string): void;
    claimOwner(openid: string, profile: MemberProfile): void;
    revokeOwner(openid: string): void;
    /** Read a previously saved display name without importing or rewriting its Session or policy. */
    peerName(scope: 'group' | 'c2c', peerId: string): {
        name: string;
        alias: string;
    };
    private legacyCatalog;
    private hasLegacyPreferences;
    /**
     * 解析结果缓存，以文件身份（ino + mtime + size）为键；其他实例的写入靠 stat 变化检测重读。
     * atomicWrite 经 rename 落盘，每次写入都换 inode，因此 ino 能覆盖秒级 mtime 文件系统上
     * 「同一秒写入等长内容」的误命中。缓存的 state 只读，变更方法一律构造新对象。
     */
    private cache?;
    private load;
    private save;
}
export {};
//# sourceMappingURL=member-store.d.ts.map