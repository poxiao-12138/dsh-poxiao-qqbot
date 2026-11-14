import type { ImQQBotConfig, MemoryConfig } from '../config.ts';
import type { Logger } from '../types.ts';
export interface TranscriptLine {
    seq: number;
    messageId?: string;
    role: '对方' | '角色' | '小世界回执';
    text: string;
}
export declare function extractTranscript(lines: string[]): TranscriptLine[];
interface Candidate {
    title: string;
    body: string;
    type: string;
    sourceSeqs: number[];
    links: string[];
    supplements?: string;
}
export declare const BUILTIN_RULES: string;
export declare function generateCandidates(transcript: TranscriptLine[], rules: string, noteNames: string[], key: string): Promise<Candidate[]>;
export interface OrganizerRunResult {
    ok: boolean;
    message: string;
}
export declare function runBuiltInOrganizer(config: ImQQBotConfig, logger: Logger): Promise<OrganizerRunResult>;
/** 立即整理（供 UI 或手动触发） */
export declare function runOrganizerNow(memory: MemoryConfig | undefined, logger: Logger, config?: ImQQBotConfig): OrganizerRunResult;
/** 每日定时：时间点命中时跑内置整理（仅 DSH 运行期间） */
export declare function installMemoryOrganizer(ctx: unknown, config: ImQQBotConfig, logger: Logger): void;
export {};
//# sourceMappingURL=organizer.d.ts.map