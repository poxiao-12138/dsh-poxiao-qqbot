import type { Context } from '@deepseek-ai/cordis';
import type { ImQQBotConfig } from '../config.ts';
import type { SessionManager } from '../session/index.ts';
import type { Logger } from '../types.ts';
import { type MediaSenderLike } from './send-media.ts';
import type { DeliveryTargetResolver } from '../transport/turn-tracker.ts';
export declare function libraryDir(config: ImQQBotConfig): string;
/** Identical bytes share an index entry, including previously migrated images. */
export declare function createStickerCollector(config: ImQQBotConfig): (source: string, classify: () => Promise<string>, signal?: AbortSignal) => Promise<void>;
export declare function registerStickerTools(ctx: Context, bot: MediaSenderLike, manager: SessionManager, config: ImQQBotConfig, logger: Logger, targets?: DeliveryTargetResolver): void;
//# sourceMappingURL=sticker-tools.d.ts.map