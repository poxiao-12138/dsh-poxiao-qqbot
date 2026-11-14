import type { ImQQBotConfig, MemoryConfig } from '../config.ts';
import type { Logger } from '../types.ts';
export interface OrganizerRunResult {
    ok: boolean;
    message: string;
}
/** 跑一次内置整理（同步流程但异步执行；失败安静记录） */
export declare function runBuiltInOrganizer(config: ImQQBotConfig, logger: Logger): Promise<OrganizerRunResult>;
/** 立即整理（供 UI 或手动触发） */
export declare function runOrganizerNow(memory: MemoryConfig | undefined, logger: Logger, config?: ImQQBotConfig): OrganizerRunResult;
/** 每日定时：时间点命中时跑内置整理（仅 DSH 运行期间） */
export declare function installMemoryOrganizer(ctx: unknown, config: ImQQBotConfig, logger: Logger): void;
//# sourceMappingURL=organizer.d.ts.map