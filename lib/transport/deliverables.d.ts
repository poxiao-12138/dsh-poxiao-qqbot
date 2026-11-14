import type { ImQQBotConfig } from '../config.ts';
import type { Logger, ReplyTarget } from '../types.ts';
import { type MediaSenderLike } from '../media/send-media.ts';
import type { PresentedFileRef } from './events.ts';
import type { QQBotSender } from './outbound-buffer.ts';
/** 交付物投递器（outbound 路由只依赖此接口，便于测试注入） */
export interface DeliverablesDelivererLike {
    deliver: (target: ReplyTarget, files: PresentedFileRef[]) => Promise<void>;
}
export declare class DeliverablesDeliverer implements DeliverablesDelivererLike {
    private readonly sender;
    private readonly mediaBot;
    private readonly config;
    private readonly logger;
    constructor(sender: QQBotSender, mediaBot: MediaSenderLike, config: ImQQBotConfig, logger: Logger);
    /** 轮末投递一批声明文件到本回合目标：逐个发送，未送达的聚合为一条文字提示 */
    deliver(target: ReplyTarget, files: PresentedFileRef[]): Promise<void>;
}
//# sourceMappingURL=deliverables.d.ts.map