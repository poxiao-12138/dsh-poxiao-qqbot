/**
 * dsh-im-qqbot 插件配置 Schema
 */
import { DEFAULT_VOICE_INSTRUCTIONS } from './shared/voice-defaults.ts';
import Schema from '@deepseek-ai/schemastery';
import { DEFAULT_WAKE_BATCH_SECONDS } from './shared/bind-protocol.ts';

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
  directPrompt?: string;  /** 单条消息最大长度（QQ 限制约 5000 字符） */
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
  personaEvolutionEnabled?: boolean;
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
export const AccessControlSchema: Schema<AccessControlConfig> = Schema.object({
  c2cMode: Schema.union(['open', 'allowlist', 'disabled']).default('allowlist').description('私聊访问模式（默认白名单）'),
  commandMode: Schema.union(['open', 'allowlist', 'disabled']).default('allowlist').description('斜杠命令模式（所有人／白名单／关闭）'),
  c2cAllow: Schema.array(Schema.string()).default([]).description('C2C白名单（QQ OpenID）'),
  groupMode: Schema.union(['open', 'allowlist', 'disabled']).default('allowlist').description('群聊访问模式（默认白名单）'),
  groupAllow: Schema.array(Schema.string()).default([]).description('群聊白名单（群 OpenID）'),
});

export const VoiceSchema: Schema<VoiceConfig> = Schema.object({
    enabled: Schema.boolean().default(false).description('是否启用渠道级语音（私聊回复自动合成语音条；默认关闭，安装包 patch 里开启）'),
    mode: Schema.union(['voiceOnly', 'both', 'text', 'auto']).default('voiceOnly')
      .description('语音模式：voiceOnly=只发语音；both=语音+文字；text=关闭；auto=由角色用 [[语音]]/[[文字]] 标记决定'),
    autoDefault: Schema.union(['text', 'voice']).default('text').description('auto 模式无标记时的默认渠道'),
    groupVoice: Schema.boolean().default(false).description('群聊是否也发语音（默认只私聊）'),
    maxChars: Schema.number().default(150).description('单条语音最大字数，超长回落文字'),
    fallbackText: Schema.boolean().default(true).description('合成/发送失败时是否回落文字'),
    instructions: Schema.string().default(DEFAULT_VOICE_INSTRUCTIONS).description('默认表演指令（可空）'),
    voiceId: Schema.string().default('').description('覆盖 Breeze 音色（空则用凭证里的 voiceId）'),
    apiKey: Schema.string().default('').description('覆盖 Breeze API Key（空则读 QQ_VOICE_POLISH_BREEZE）'),
    baseURL: Schema.string().default('https://api.breeze.blue').description('Breeze API 根地址'),
    timeoutMs: Schema.number().default(30000).description('合成超时(ms)'),
    guidanceScale: Schema.number().default(2.6).description('情绪强度（无情绪时）'),
    guidanceScaleEmotion: Schema.number().default(3.5).description('情绪强度（有表演指令时）'),
    fadeMs: Schema.number().default(30).description('尾部淡出(ms)，防截断感'),
    padMs: Schema.number().default(1000).description('尾部静音(ms)，防末字被吃掉'),
    sampleRate: Schema.number().default(16000).description('输出采样率'),
    channels: Schema.union([1, 2]).default(1).description('输出声道'),
    autoPunctuation: Schema.boolean().default(true).description('自动补终止标点'),
    emotionMarkers: Schema.boolean().default(true).description('解析并剥离 [[情绪:…]] 标记'),
    polish: Schema.boolean().default(false).description('启用台词润色（需 DEEPSEEK_API_KEY）'),
    polishPrompt: Schema.string().default('').description('润色提示词（空则用内置）'),
    retries: Schema.number().default(2).description('合成失败重试次数'),
    outputFormat: Schema.union(['wav', 'mp3']).default('wav').description('发送格式（mp3 需 ffmpeg）'),
  }).default({
    enabled: false,
    mode: 'voiceOnly',
    autoDefault: 'text',
    groupVoice: false,
    maxChars: 150,
    fallbackText: true,
    instructions: DEFAULT_VOICE_INSTRUCTIONS,
    voiceId: '',
    apiKey: '',
    baseURL: 'https://api.breeze.blue',
    timeoutMs: 30000,
    guidanceScale: 2.6,
    guidanceScaleEmotion: 3.5,
    fadeMs: 30,
    padMs: 1000,
    sampleRate: 16000,
    channels: 1,
    autoPunctuation: true,
    emotionMarkers: true,
    polish: false,
    polishPrompt: '',
    retries: 2,
    outputFormat: 'wav',
  }).description('渠道级语音配置');

export const MemorySchema: Schema<MemoryConfig> = Schema.object({
    enabled: Schema.boolean().default(false).description('是否启用长期记忆检索'),
    backend: Schema.union(['obsidian', 'none']).default('obsidian').description('记忆后端'),
    vaultPath: Schema.string().default('').description('Obsidian 库根目录'),
    scope: Schema.string().default('').description('限定 scope（空=不限）'),
    topK: Schema.number().default(4).description('每次最多返回篇数'),
    maxChars: Schema.number().default(1200).description('返回内容总字数上限'),
    verifiedOnly: Schema.boolean().default(true).description('只检索 review: verified 的笔记'),
    promptRule: Schema.boolean().default(true).description('自动把“先查记忆”的规则加进提示词'),
    organizeEnabled: Schema.boolean().default(false).description('启用记忆自动整理'),
    organizeCommand: Schema.string().default('').description('整理命令（空则不跑）'),
    organizeTimes: Schema.string().default('04:10,13:10').description('每天整理时间，逗号分隔 HH:MM'),
    idleMinutes: Schema.number().default(30).description('会话空闲多少分钟后整理（0=只按时间点）'),
  }).default({
    enabled: false,
    backend: 'obsidian',
    vaultPath: '',
    scope: '',
    topK: 4,
    maxChars: 1200,
    verifiedOnly: true,
    promptRule: true,
    organizeEnabled: false,
    organizeCommand: '',
    organizeTimes: '04:10,13:10',
    idleMinutes: 30,
  }).description('长期记忆（可选）');

export const StickerSchema: Schema<StickerConfig> = Schema.object({
    autoCollect: Schema.boolean().default(true).description('自动识别并收藏收到的表情'),
    enabled: Schema.boolean().default(true).description('是否启用表情包收发工具'),
    dir: Schema.string().default('').description('表情库目录（空 = ~/.dsh-qqbot/stickers）'),
  }).default({
    enabled: true,
    autoCollect: true,
    dir: '',
  }).default({
    enabled: true,
    autoCollect: true,
    dir: '',
  }).description('表情包库（可选）');

export const ConfigSchema: Schema<ImQQBotConfig> = Schema.object({
  appId: Schema.string().default('').description('QQ 机器人 AppID'),
  appSecret: Schema.string().default('').description('QQ 机器人 AppSecret'),
  provider: Schema.string().description('LLM provider name'),
  model: Schema.string().description('Model name'),
  preset: Schema.string().description('Agent preset id'),
  cwd: Schema.string().description('Agent working directory (default ~/.dsh-qqbot/workspace)'),
  requireMention: Schema.boolean().default(true).description('群聊是否需要@bot触发'),
  groupPrompt: Schema.string().description('群聊额外system prompt'),
  directPrompt: Schema.string().description('私聊额外system prompt'),
  textChunkLimit: Schema.number().default(4500).description('单条消息最大字符数'),
  streaming: Schema.boolean().default(true).description('是否启用流式输出（群聊始终不启用）'),
  sessionIdleTimeout: Schema.number().default(30 * 60 * 1000).description('会话闲置超时(ms)，<=0 不回收'),
  maxQueue: Schema.number().default(20).description('并发队列最大长度'),
  processingTimeoutMs: Schema.number().default(30 * 60 * 1000).description('处理超时(ms)，超时中断当前 LLM 调用'),
  askTimeoutMs: Schema.number().default(5 * 60 * 1000).description('待答问题超时(ms)，超时自动拒绝并提示'),
  proactiveWakeEnabled: Schema.boolean().default(true),
  personaEvolutionEnabled: Schema.boolean().default(true),
  wakeBatchSeconds: Schema.number().min(0).max(30).default(DEFAULT_WAKE_BATCH_SECONDS),
  historyLimit: Schema.number().default(10).description('群历史缓冲条数'),
  access: AccessControlSchema.default({
    c2cMode: 'allowlist',
    commandMode: 'allowlist',
    c2cAllow: [],
    groupMode: 'allowlist',
    groupAllow: [],
  }).description('访问控制'),
  showToolResults: Schema.boolean().default(false).description('是否展示工具调用成功结果（错误始终展示）'),
  debug: Schema.boolean().default(false),
  media: Schema.object({
    enabled: Schema.boolean().default(true).description('是否启用富媒体理解（图片/视频下载 + 工具分析）'),
    maxMB: Schema.number().default(200).description('富媒体下载大小上限(MB)'),
    ttlHours: Schema.number().default(24).description('富媒体存活时长(小时)，0=永不过期'),
  }).default({
    enabled: true,
    maxMB: 200,
    ttlHours: 24,
  }).description('富媒体理解配置'),
  vision: Schema.object({
    enabled: Schema.boolean().default(false).description('是否启用视觉理解（qqbot_describe_image 工具）'),
    provider: Schema.string().default('').description('视觉模型 provider（dsh 注册的 llm adapter，如 pi-ai）'),
    model: Schema.string().default('').description('视觉模型 id（如 qwen-vl-max）'),
    defaultPrompt: Schema.string().default('Describe this image in detail.').description('默认描述 prompt'),
    maxBytes: Schema.number().default(10 * 1024 * 1024).description('图片字节上限'),
    maxTokens: Schema.number().default(1024).description('输出 token 上限'),
    timeoutMs: Schema.number().default(120000).description('视觉调用超时(ms)'),
  }).default({
    enabled: false,
    provider: '',
    model: '',
    defaultPrompt: 'Describe this image in detail.',
    maxBytes: 10 * 1024 * 1024,
    maxTokens: 1024,
    timeoutMs: 120000,
  }).description('视觉理解配置'),
  sendFile: Schema.object({
    restrictPaths: Schema.boolean().default(true).description('是否启用路径白名单（默认 true，仅允许 media + cwd + extraRoots）'),
    extraRoots: Schema.array(Schema.string()).default([]).description('额外允许访问的根目录'),
    sendPresentedFiles: Schema.boolean().default(true).description('是否将 present 声明的交付文件发送到当前会话'),
    maxFiles: Schema.number().default(4).description('单轮最多投递的交付文件数'),
  }).default({
    restrictPaths: true,
    extraRoots: [],
    sendPresentedFiles: true,
    maxFiles: 4,
  }).description('附件发送配置'),
  voice: VoiceSchema,
  memory: MemorySchema,
  stickers: StickerSchema,



  proactiveDelivery: Schema.object({
    externalTurns: Schema.union(['off', 'c2c', 'all']).default('c2c')
      .description('非 QQ 输入（如桌面续聊）的回合是否推送到 QQ：off=不推送，c2c=仅私聊，all=私聊和群聊'),
  }).default({
    externalTurns: 'c2c',
  }).description('主动推送策略（定时任务等服务回合始终推送）'),
});
