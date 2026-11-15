/**
 * 把 QQ 的 prompt section/context 注册到某个 agent 的 ctx（per-agent scope）。
 *
 * 与 installPolicy 同生命周期：agent 挂载时安装，agent 销毁时 dispose。
 * 使用 DSH 正规扩展点 ctx.systemPrompt.section()/context()，不再走 system-prompt/assemble waterfall。
 * 所有 section.text 都是惰性函数，每步组装时现读 entry —— 改补充词/人设即时生效，无需重注册。
 */
import type { Context } from '@deepseek-ai/cordis';
import type { QQScope } from './scope.ts';
/** Frozen facts from the exact QQ input claimed for the current native turn. */
export interface QQTurnContext {
    readonly turnMetaText: string;
    readonly backgroundText: string;
}
/** 当前会话 prompt 需要的数据（惰性读取，保证热更新）。全部字段默认空——空文本的 section/context 会被丢弃。 */
export interface QQPromptEntry {
    readonly scope: QQScope;
    /** 人设 role-card markdown（可为空）。 */
    personaCard(): string;
    voiceAvailable?(): boolean;
    evolution?(): string;
    /** 补充提示词（群/私分字段）。 */
    extraPrompts(): {
        group?: string;
        direct?: string;
    };
    /** Read only the current turn's verified input; queued and previous turns return nothing. */
    turnContext?(): QQTurnContext | undefined;
}
/** 已安装的 QQ prompt 注册项。 */
export interface QQPromptHandle {
    dispose(): void;
}
/** 在 agent.ctx 上安装 QQ prompt sections/contexts；返回可更新的句柄。 */
export declare function installQQPrompt(agentCtx: Context, entry: QQPromptEntry): QQPromptHandle;
//# sourceMappingURL=install.d.ts.map