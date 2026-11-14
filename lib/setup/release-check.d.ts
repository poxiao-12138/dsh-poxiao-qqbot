export interface AvailableRelease {
    installed: string;
    version: string;
    address: string;
}
export declare function compareVersions(left: string, right: string): number;
export declare function checkRelease(manifest?: {
    version: string;
    poxiaoUpdates?: {
        channel: 'gitee' | 'github';
        repository?: string;
    };
}, request?: typeof fetch): Promise<AvailableRelease | null>;
//# sourceMappingURL=release-check.d.ts.map