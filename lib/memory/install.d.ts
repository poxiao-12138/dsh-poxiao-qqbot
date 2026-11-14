/**
 * 长期记忆的插件侧装配：
 * 1) 注册 memory_search 工具（agent 在回答过去的事之前主动查）；
 * 2) 可选地把“先查记忆”的规则追加到私聊/群聊提示词。
 *
 * 工具是可选能力：记忆配置关闭时什么都不注册，不影响开箱使用。
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ImQQBotConfig } from '../config.ts';
import type { Logger } from '../types.ts';
/** 给提示词追加“先查记忆”的规则（不改变用户自己写的提示词） */
export declare function withMemoryPrompt(config: ImQQBotConfig): ImQQBotConfig;
/** 注册 memory_search 工具；宿主无 tools 服务时静默跳过（其他功能不受影响） */
export declare function installMemoryTool(ctx: Context, config: ImQQBotConfig, logger: Logger): void;
//# sourceMappingURL=install.d.ts.map