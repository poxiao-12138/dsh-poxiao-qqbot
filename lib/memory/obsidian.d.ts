import type { MemoryConfig } from '../config.ts';
export interface MemoryHit {
    path: string;
    title: string;
    snippet: string;
    score: number;
}
/** 中文按 2-gram、英文按单词切成检索词 */
export declare function tokenize(query: string): string[];
export declare function searchMemory(config: MemoryConfig, query: string): {
    results: MemoryHit[];
    scanned: number;
};
//# sourceMappingURL=obsidian.d.ts.map