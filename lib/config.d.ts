/**
 * dsh-im-qqbot 插件配置 Schema
 */
import Schema from '@deepseek-ai/schemastery';
export interface AccessControlConfig {
    /** C2C 访问模式 */
    c2cMode: 'open' | 'allowlist' | 'disabled';
    /** C2C 白名单（user openid） */
    c2cAllow: string[];
    /** 群聊访问模式 */
    groupMode: 'open' | 'allowlist' | 'disabled';
    /** QQ 斜杠命令模式，缺省所有获准接入的发送者可用 */
    commandMode?: 'open' | 'allowlist' | 'disabled';
    /** 群聊白名单（group openid） */
    groupAllow: string[];
}
export interface MediaConfig {
    /** 是否启用富媒体理解（图片/视频下载 + 工具分析） */
    enabled: boolean;
    /** 富媒体下载大小上限（MB），默认 200 */
    maxMB: number;
    /** 富媒体存活时长（小时，TTL），默认 24，0 = 永不过期 */
    ttlHours: number;
}
export interface VisionConfig {
    /** 是否启用视觉理解（qqbot_describe_image 工具） */
    enabled: boolean;
    /** 视觉模型 provider（dsh 注册的 llm adapter，如 pi-ai） */
    provider: string;
    /** 视觉模型 id（如 qwen-vl-max） */
    model: string;
    /** 默认描述 prompt（调用未显式指定时使用） */
    defaultPrompt: string;
    /** 图片字节上限，默认 10MB */
    maxBytes: number;
    /** 输出 token 上限 */
    maxTokens: number;
    /** 视觉调用超时(ms) */
    timeoutMs: number;
}
/** 附件发送配置（qqbot_send_file 工具与 present 交付物投递共用） */
export interface SendFileConfig {
    /** 是否启用路径白名单（默认 true，仅允许 media + cwd + extraRoots；关闭则任意路径） */
    restrictPaths: boolean;
    /** 额外允许访问的根目录（media 和 agent cwd 始终默认允许） */
    extraRoots: string[];
    /** 是否把 present 声明的交付文件在轮末发送到当前会话 */
    sendPresentedFiles: boolean;
    /** 单轮最多投递的交付文件数 */
    maxFiles: number;
}
/**
 * 非 QQ 读者输入（如桌面端续聊 QQ 会话）的回合是否主动推送到 QQ。
 * - off：不推送，回复只留在发起的界面；
 * - c2c：只推送私聊会话（默认，避免桌面上的私人操作出现在群里）；
 * - all：私聊和群聊都推送。
 */
export type ExternalTurnDelivery = 'off' | 'c2c' | 'all';
/** 主动推送策略（定时任务等服务回合始终主动推送） */
export interface ProactiveDeliveryConfig {
    externalTurns: ExternalTurnDelivery;
}
export interface VoiceConfig {
    /** 是否启用渠道级语音（私聊文字回复自动合成语音条） */
    enabled: boolean;
    /** 语音模式：voiceOnly=只发语音；both=语音+文字；text=关闭；auto=由角色用 [[语音]]/[[文字]] 标记决定 */
    mode: 'voiceOnly' | 'both' | 'text' | 'auto';
    /** auto 模式下没有标记时的默认渠道：text=默认文字，voice=默认语音 */
    autoDefault: 'text' | 'voice';
    /** 群聊是否也发语音（默认 false） */
    groupVoice: boolean;
    /** 单条语音最大字数 */
    maxChars: number;
    /** 合成失败时是否回落文字 */
    fallbackText: boolean;
    /** 默认表演指令（可空） */
    instructions: string;
    /** 可选：覆盖 Breeze 音色（空则用凭证里的 voiceId） */
    voiceId: string;
    /** 可选：覆盖 Breeze API Key（空则读 QQ_VOICE_POLISH_BREEZE） */
    apiKey: string;
    /** Breeze API 根地址 */
    baseURL: string;
    /** 合成超时(ms) */
    timeoutMs: number;
    /** 情绪强度（无情绪时）：默认 2.6 */
    guidanceScale: number;
    /** 情绪强度（有表演指令时）：默认 3.5 */
    guidanceScaleEmotion: number;
    /** 尾部淡出时长(ms)：默认 30，防截断感 */
    fadeMs: number;
    /** 尾部静音(ms)：默认 1000，防最后一个字被吃掉 */
    padMs: number;
    /** 输出采样率：默认 16000 */
    sampleRate: number;
    /** 输出声道：默认 1（单声道） */
    channels: 1 | 2;
    /** 自动补终止标点（防末字被吃掉） */
    autoPunctuation: boolean;
    /** 解析并剥离 [[情绪:…]] 标记（当表演指令用） */
    emotionMarkers: boolean;
    /** 是否启用台词润色（需 DEEPSEEK_API_KEY，默认关闭） */
    polish: boolean;
    /** 润色提示词（空则用内置） */
    polishPrompt: string;
    /** 合成失败重试次数 */
    retries: number;
    /** 发送格式：wav（默认）/ mp3（需 ffmpeg） */
    outputFormat: 'wav' | 'mp3';
}
export interface MemoryConfig {
    /** 是否启用长期记忆检索 */
    enabled: boolean;
    /** 记忆后端：目前支持 obsidian，预留 none/其他 */
    backend: 'obsidian' | 'none';
    /** Obsidian 库根目录（本地路径） */
    vaultPath: string;
    /** 限定 scope（空 = 不限）；与笔记 frontmatter scope 匹配 */
    scope: string;
    /** 每次最多返回几篇 */
    topK: number;
    /** 返回内容总字数上限 */
    maxChars: number;
    /** 只检索 review: verified 的笔记 */
    verifiedOnly: boolean;
    /** 自动把“先查记忆”的规则加进提示词 */
    promptRule: boolean;
    /** 自动整理：启用后插件进程按时间点跑整理命令 */
    organizeEnabled: boolean;
    /** 整理命令（例如 node /path/to/memory-auto-trigger.mjs），空则不跑 */
    organizeCommand: string;
    /** 每天整理时间，逗号分隔 HH:MM（例如 04:10,13:10） */
    organizeTimes: string;
    /** 会话空闲多少分钟后触发整理（0 = 不用空闲触发，只按时间点） */
    idleMinutes: number;
}
export interface StickerConfig {
    autoCollect?: boolean;
    /** 是否启用表情包工具 */
    enabled: boolean;
    /** 表情库目录（空 = ~/.dsh-qqbot/stickers） */
    dir: string;
}
export interface ImQQBotConfig {
    /** QQ Bot AppID */
    appId: string;
    /** QQ Bot AppSecret */
    appSecret: string;
    /** dsh LLM 提供商名称 */
    provider?: string;
    /** 模型名称 */
    model?: string;
    /** Agent preset id */
    preset?: string;
    /** Agent 工作目录（缺省 ~/.dsh-qqbot/workspace，不随宿主进程 cwd） */
    cwd?: string;
    /** 是否启用群消息 @mention 门控 */
    requireMention: boolean;
    /** 群聊额外 system prompt */
    groupPrompt?: string;
    /** 私聊额外 system prompt */
    directPrompt?: string; /** 单条消息最大长度（QQ 限制约 5000 字符） */
    textChunkLimit: number;
    /** 是否启用流式输出（群聊始终不启用） */
    streaming: boolean;
    /** 每会话最大闲置时长(ms)，超时自动回收；<=0 表示不回收 */
    sessionIdleTimeout: number;
    /** 并发队列最大长度 */
    maxQueue: number;
    /** 处理超时(ms)，超时中断当前 LLM 调用 */
    processingTimeoutMs: number;
    /** 待答问题超时(ms)，超时自动拒绝并提示（ask_user_question） */
    askTimeoutMs: number;
    /** 群历史缓冲条数 */
    historyLimit: number;
    wakeBatchSeconds?: number;
    proactiveWakeEnabled?: boolean;
    /** 访问控制 */
    access: AccessControlConfig;
    /** 是否展示工具调用成功结果（工具错误始终展示） */
    showToolResults: boolean;
    /** 调试模式 */
    debug: boolean;
    /** 富媒体理解（图片/视频） */
    media: MediaConfig;
    /** 视觉理解（qqbot_describe_image 工具，走 dsh llm + attachments） */
    vision: VisionConfig;
    /** 附件发送（qqbot_send_file 工具与交付物投递共用） */
    sendFile: SendFileConfig;
    /** 渠道级语音（私聊自动语音条） */
    voice: VoiceConfig;
    /** 长期记忆（可选，目前支持 Obsidian） */
    memory: MemoryConfig;
    /** 表情包库（可选） */
    stickers: StickerConfig;
    /** 主动推送策略 */
    proactiveDelivery: ProactiveDeliveryConfig;
}
/** 访问控制子 Schema（独立导出：config 路由的服务端校验复用） */
export declare const AccessControlSchema: Schema<AccessControlConfig>;
export declare const VoiceSchema: Schema<VoiceConfig>;
export declare const MemorySchema: Schema<MemoryConfig>;
export declare const StickerSchema: Schema<StickerConfig>;
export declare const ConfigSchema: Schema<ImQQBotConfig>;
//# sourceMappingURL=config.d.ts.map