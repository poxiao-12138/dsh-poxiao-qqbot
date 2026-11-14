import type { SessionManager } from '../session/index.ts';
import type { ImQQBotConfig } from '../config.ts';
import type { Logger } from '../types.ts';
import { type QQBotSender } from './outbound-buffer.ts';
import { type ToolsRegistryLike } from './tool-presenter.ts';
import type { DeliverablesDelivererLike } from './deliverables.ts';
import type { MediaSenderLike } from '../media/send-media.ts';
import { QqInputRegistry } from './qq-input-origin.ts';
import { TurnTracker } from './turn-tracker.ts';
import { type RawSessionEvent, type StreamDelta } from './events.ts';
export type { QQBotSender } from './outbound-buffer.ts';
export type { ToolsRegistryLike } from './tool-presenter.ts';
export { parseStreamFrame } from './events.ts';
/** 出站处理器签名（注册到 ctx.on('session/event')） */
export type OutboundHandler = (session: SessionLike, event: RawSessionEvent) => void;
/** 出站事件入口集合：durable 事件 + 实时流式帧 */
export interface OutboundHandlers {
    /** durable session 事件入口（注册到 ctx.on('session/event')） */
    routeSessionEvent(session: SessionLike, event: RawSessionEvent): void;
    /**
     * 实时流式帧入口（注册到 ctx.on('agent/assistant-stream', ..., { global: true })）。
     */
    routeStreamFrame(agentId: string, delta: StreamDelta): void;
}
/** dsh Session 简化类型 */
export interface SessionLike {
    header: {
        id: string;
    };
}
/** 按配置组装回合跟踪器（入站登记表需与 handleInbound 共享同一实例） */
export declare function createTurnTracker(manager: SessionManager, config: ImQQBotConfig, logger: Logger, inputs?: QqInputRegistry): TurnTracker;
/**
 * 创建出站事件处理器
 *
 * 返回 durable 事件与实时流式帧两个入口，分别注册到
 * ctx.on('session/event') 与 ctx.on('agent/assistant-stream', ..., { global: true })。
 * toolsRegistry 用于工具结果的结构化展示；deliverer 用于轮末投递 present 声明的交付文件；
 * tracker 为回合归属的单一事实源，需与提问/审批/发文件共享时由调用方注入。
 */
export declare function createOutboundHandler(manager: SessionManager, bot: QQBotSender, config: ImQQBotConfig, logger: Logger, toolsRegistry?: ToolsRegistryLike, deliverer?: DeliverablesDelivererLike, tracker?: TurnTracker, media?: MediaSenderLike): OutboundHandlers;
//# sourceMappingURL=outbound.d.ts.map