import { type MediaSenderLike } from '../media/send-media.ts';
import type { ImQQBotConfig } from '../config.ts';
import type { Logger, ReplyTarget } from '../types.ts';
export type VoiceOutcome = 'sent' | 'skipped' | 'failed';
/**
 * 逐条语音指令：[[语音]] / [[文字]]（括号可单个）。
 * 只在 auto 模式下作为"这条要不要语音"的依据；任何语音模式都会剥离标记，避免被念出来。
 */
export declare function extractVoiceDirective(text: string): {
    text: string;
    directive: 'voice' | 'text' | null;
};
export declare class VoiceService {
    private readonly config;
    private readonly logger;
    private readonly media;
    private cached;
    private warnedMissing;
    constructor(config: ImQQBotConfig, logger: Logger, media?: MediaSenderLike);
    /** 该 scope 是否允许发语音（配置 + 凭证都在才允许） */
    applicable(scope: ReplyTarget['scope']): boolean;
    private credentials;
    /** 文字是否不适合朗读（链接、代码、表格、错误提示、超长） */
    private unsuitable;
    /** 合成（带重试），返回 wav Buffer */
    private synthesize;
    /**
     * 尝试把一段文字发成语音；返回是否已经发出去。
     * 管线：情绪标记 → 可选润色 → 补标点 → 合成 → 后处理 → 格式转换 → 发送。
     */
    sendVoice(bot: MediaSenderLike | undefined, target: ReplyTarget, text: string, checked?: boolean): Promise<VoiceOutcome>;
}
//# sourceMappingURL=index.d.ts.map