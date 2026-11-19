import { extractEmotionMarkers, extractHummingMarker } from "../voice/emotion.js";
/**
 * 出站处理器 — dsh session/event → QQ 消息发送
 *
 * 采用路由器模式：OutboundRouter 持有会话级状态（文本缓冲、工具调用记录），
 * 事件解析归一化在 events.ts，路由按事件类型分发到私有方法。
 */
import { logProactiveWake, proactiveText } from "../gateway/proactive-wake.js";
import { checkedWorldReply, isCheckedWorldAction } from "./world-receipt.js";
import { chunkMarkdownText } from "./chunker.js";
import { OutboundBuffer } from "./outbound-buffer.js";
import { formatToolResult } from "./tool-presenter.js";
import { VoiceService, extractVoiceDirective } from "../voice/index.js";
import { QqInputRegistry } from "./qq-input-origin.js";
import { TurnTracker } from "./turn-tracker.js";
import { parseEvent, extractTurnError, } from "./events.js";
export { parseStreamFrame } from "./events.js";
/** 不展示给用户的轮次错误码（底层传输/网络错误，对用户无意义，且常被重试兜住） */
const SILENT_TURN_ERROR_CODES = new Set(['STREAM_CLOSED']);
/**
 * 出站路由器：持有会话级状态，按事件类型分发到处理器。
 * 回合归属与投递目标委托给 TurnTracker（与提问/审批/发文件共享）。
 */
class OutboundRouter {
    buffers = new Map();
    checkedReplies = new Map();
    toolCalls = new Map();
    streamAttempts = new Map();
    /** 每会话本轮已声明的交付文件（deliverables/presented，轮末清空） */
    presentedFiles = new Map();
    /** 每会话已见过的 present callId（轮内去重，防事件重放导致重复投递） */
    presentedCalls = new Map();
    /**
     * 每会话最后一笔在途文本发送（assistant/message 的 flush 是 fire-and-forget，
     * turn/end 时需等待其完成再投递交付文件，保证回复文本先于文件到达用户）。
     */
    pendingText = new Map();
    manager;
    bot;
    config;
    logger;
    toolsRegistry;
    deliverer;
    tracker;
    voiceService;
    media;
    constructor(manager, bot, config, logger, tracker, toolsRegistry, deliverer, media) {
        this.manager = manager;
        this.bot = bot;
        this.config = config;
        this.logger = logger;
        this.tracker = tracker;
        this.toolsRegistry = toolsRegistry;
        this.deliverer = deliverer;
        this.media = media;
        this.voiceService = new VoiceService(config, logger, media);
    }
    /** 事件分发入口 */
    route(session, raw) {
        const sessionId = session.header.id;
        if (raw.type === 'turn/start') {
            if (this.tracker.begin(sessionId, eventTurn(raw.data)))
                this.resetTurnState(sessionId);
            return;
        }
        if (raw.type === 'user/message') {
            this.tracker.note(sessionId, raw.data);
            return;
        }
        if (!this.tracker.isCurrent(sessionId, raw.type, eventTurn(raw.data)))
            return;
        const event = parseEvent(raw);
        if (event === undefined)
            return;
        const plan = this.tracker.planFor(sessionId);
        if (event.type === 'turn/end') {
            this.tracker.end(sessionId);
            this.finishTurn(sessionId, event, plan);
            return;
        }
        if (plan === undefined)
            return;
        const record = this.manager.findBySessionId(sessionId);
        if (plan.idleWake && event.type !== 'assistant/message')
            return;
        switch (event.type) {
            case 'assistant/chunk':
                this.appendChunk(sessionId, plan, event.text);
                break;
            case 'assistant/message':
                void this.onMessage(sessionId, plan, event);
                break;
            case 'tool/call':
                if (record !== undefined)
                    this.onToolCall(event);
                break;
            case 'tool/result':
                if (record !== undefined)
                    this.onToolResult(sessionId, record, plan, event);
                break;
            case 'deliverables/presented':
                this.onPresented(sessionId, event);
                break;
        }
    }
    /**
     * 实时流式帧入口（瞬态 agent/assistant-stream 事件）。
     *
     * attempt 语义：start 帧即新内容起点，无条件重置 buffer——清空旧 attempt 的
     * 累积文本但保留流式会话（QQ 流式 update 是全量替换，用户看到同一条消息被
     * 新内容重写）。不用 attemptId 对比判断"新 attempt"：agent replacement 后
     * attempt 计数重启、attemptId 可能与旧 agent 重叠（官方按 frame revision 的
     * gap 检测处理同一问题）。迟到帧（attemptId 不匹配）仍直接丢弃，防止旧
     * attempt 的尾巴混进新内容。
     */
    routeStreamFrame(agentId, delta) {
        if (delta.kind === 'attempt-start') {
            this.streamAttempts.set(agentId, delta.attemptId);
            this.buffers.get(agentId)?.reset();
            return;
        }
        // text-delta：首帧未见 start 时自愈记录，迟到帧丢弃
        const current = this.streamAttempts.get(agentId);
        if (current === undefined) {
            this.streamAttempts.set(agentId, delta.attemptId);
        }
        else if (current !== delta.attemptId) {
            return;
        }
        // 已有 buffer：目标在创建时已拍下，直接追加，避免每帧重新解析
        const existing = this.buffers.get(agentId);
        if (existing !== undefined) {
            existing.append(delta.text);
            return;
        }
        const plan = this.tracker.planFor(agentId);
        if (plan === undefined)
            return;
        this.appendChunk(agentId, plan, delta.text);
    }
    /** 获取或创建会话 buffer 并追加增量。目标在创建时拍下，本回合内不再改。 */
    appendChunk(sessionId, plan, text) {
        if (plan.idleWake)
            return;
        let buffer = this.buffers.get(sessionId);
        if (buffer === undefined) {
            buffer = new OutboundBuffer(plan.target, this.bot, this.config.textChunkLimit, this.logger, !this.checkedReplies.has(sessionId) && this.shouldStream(plan));
            this.buffers.set(sessionId, buffer);
        }
        buffer.append(text);
    }
    /** 被动回复且 c2c 有 msgId 才流式（群聊、主动推送均不流式） */
    shouldStream(plan) {
        // 语音模式必须关闭流式：否则文字会先被流式发出去，和“只发语音”冲突。
        if (this.voiceActive(plan.target.scope))
            return false;
        return !plan.proactive
            && this.config.streaming
            && plan.target.scope === 'c2c'
            && !!plan.target.msgId;
    }
    /** 新回合开始：丢弃上一轮残留的出站状态 */
    resetTurnState(sessionId) {
        this.checkedReplies.delete(sessionId);
        this.buffers.get(sessionId)?.cancel();
        this.buffers.delete(sessionId);
        this.streamAttempts.delete(sessionId);
        this.presentedFiles.delete(sessionId);
        this.presentedCalls.delete(sessionId);
    }
    /** 当前目标是否走渠道语音（配置开启 + 凭证可用 + scope 允许） */
    voiceActive(scope) {
        return Boolean(this.config.voice?.enabled) && this.config.voice.mode !== 'text' && this.voiceService.applicable(scope);
    }
    /** 完整 assistant 消息：先取缓冲里的整段文字（语音模式缓冲不流式发送），再决定语音/文字 */
    async onMessage(sessionId, plan, event) {
        if (plan.idleWake) {
            const text = proactiveText(event.content.filter((block) => block.type === 'text').map((block) => block.text).join('\n'));
            if (text) {
                logProactiveWake('模型选择联系，开始投递');
                this.trackText(sessionId, this.deliverText(plan, text, 'sendMarkdown').catch(() => {
                    logProactiveWake('投递异常');
                }));
            }
            else {
                logProactiveWake('模型未生成可投递的文字');
            }
            return;
        }
        const buffer = this.buffers.get(sessionId);
        const checked = this.checkedReplies.get(sessionId);
        if (checked !== undefined && (buffer?.text.trim() || event.content.some((block) => block.type === 'text' && block.text?.trim()))) {
            buffer?.cancel();
            this.buffers.delete(sessionId);
            this.checkedReplies.delete(sessionId);
            this.trackText(sessionId, this.deliverText(plan, checked.join('\n'), 'sendMarkdown', true));
            return;
        }
        let fullText = '';
        if (buffer !== undefined) {
            if (!this.voiceActive(plan.target.scope)) {
                // 普通模式：沿用官方语义，flush 负责把剩余文字发出去（流式已发过的不会重复）
                this.trackText(sessionId, buffer.flush());
                this.buffers.delete(sessionId);
                return;
            }
            // 语音模式缓冲没有流式发送过：取出整段文字，取消缓冲，交给语音分支
            fullText = buffer.text;
            buffer.cancel();
            this.buffers.delete(sessionId);
        }
        if (!fullText.trim()) {
            const textParts = [];
            for (const block of event.content) {
                if (block.type === 'text' && block.text)
                    textParts.push(block.text);
            }
            fullText = textParts.join('\n');
        }
        if (!fullText.trim())
            return;
        this.trackText(sessionId, this.deliverText(plan, fullText, 'sendMarkdown'));
    }
    /**
     * 语音优先的最终文本投递：
     * - 语音可用且发送成功 + mode=voiceOnly → 只发语音；
     * - mode=both → 语音后再发文字；
     * - 语音失败/不可用 → fallbackText 决定回落文字还是不说。
     */
    async deliverText(plan, text, tag, checked = false) {
        const voice = this.config.voice ?? { enabled: false };
        let line = text;
        if (voice.enabled && voice.mode !== 'text') {
            // 逐条指令在 auto 模式下决定这条要不要语音；其他语音模式只剥离标记
            const parsed = extractVoiceDirective(line);
            line = parsed.text || line;
            const auto = voice.mode === 'auto';
            const wantVoice = !auto
                || parsed.directive === 'voice'
                || (parsed.directive === null && voice.autoDefault === 'voice');
            if (wantVoice) {
                const result = await this.voiceService.sendVoice(this.media ?? this.bot, plan.target, line, checked);
                if (plan.idleWake)
                    logProactiveWake(`语音投递结果=${result}`);
                if (result === 'sent') {
                    if (voice.mode === 'voiceOnly' || auto)
                        return;
                }
                else if (!voice.fallbackText) {
                    return;
                }
            }
        }
        const withoutDirection = extractEmotionMarkers(line);
        if (withoutDirection.instructions)
            line = withoutDirection.text;
        line = extractHummingMarker(line).text;
        if (!line)
            return;
        const delivered = await this.send(plan.target, line, tag);
        if (plan.idleWake)
            logProactiveWake(delivered ? 'QQ 文字投递成功' : 'QQ 文字投递未全部成功');
    }
    /** 记录每会话最后一笔在途文本任务（自身吞错：错误已由 send/flush 内部记录） */
    trackText(sessionId, task) {
        const previous = this.pendingText.get(sessionId) ?? Promise.resolve();
        this.pendingText.set(sessionId, Promise.all([previous, task.catch(() => { })]).then(() => { }));
    }
    /** 工具调用：仅记录，不发送（避免刷屏，等待结果） */
    onToolCall(event) {
        this.toolCalls.set(event.callId, { name: event.name, args: event.arguments });
    }
    /** 工具结果：错误始终发送，成功结果按开关 */
    onToolResult(sessionId, record, plan, event) {
        const call = this.toolCalls.get(event.callId);
        this.toolCalls.delete(event.callId);
        if (call === undefined)
            return;
        if (isCheckedWorldAction(call.name)) {
            this.buffers.get(sessionId)?.cancel();
            this.buffers.delete(sessionId);
            const message = event.raw.message;
            const replies = this.checkedReplies.get(sessionId) ?? [];
            replies.push(checkedWorldReply(call.name, message?.content, event.error !== undefined));
            this.checkedReplies.set(sessionId, replies);
            return;
        }
        if (event.error === undefined && !this.config.showToolResults)
            return;
        const text = formatToolResult(call.name, call.args, event.raw, this.toolsRegistry, record.agent);
        if (!text)
            return;
        void this.send(plan.target, text, 'sendToolResult');
    }
    /** 收集本轮声明的交付文件：事件总是先于 turn/end 到达，轮末统一投递 */
    onPresented(sessionId, event) {
        if (this.config.sendFile?.sendPresentedFiles === false)
            return;
        let calls = this.presentedCalls.get(sessionId);
        if (calls === undefined) {
            calls = new Set();
            this.presentedCalls.set(sessionId, calls);
        }
        if (calls.has(event.callId))
            return;
        calls.add(event.callId);
        const files = this.presentedFiles.get(sessionId) ?? [];
        files.push(...event.files);
        this.presentedFiles.set(sessionId, files);
    }
    /**
     * 轮次结束：文本先送达、再投递交付文件、最后清理状态，异常结束时告知用户。
     * 外层轮次失败不撤销已完成的声明（宿主契约），故失败轮的文件仍投递。
     */
    finishTurn(sessionId, event, plan) {
        const buffer = this.buffers.get(sessionId);
        // 文本 flush 可等待，保证回复先于交付文件到达用户
        let flushTask = Promise.resolve();
        const checked = this.checkedReplies.get(sessionId);
        this.checkedReplies.delete(sessionId);
        if (checked !== undefined && plan !== undefined) {
            buffer?.cancel();
            this.buffers.delete(sessionId);
            flushTask = this.deliverText(plan, checked.join('\n'), 'sendMarkdown', true);
        }
        else if (buffer !== undefined) {
            if (plan !== undefined && this.voiceActive(plan.target.scope)) {
                const buffered = buffer.text;
                buffer.cancel();
                this.buffers.delete(sessionId);
                if (buffered.trim())
                    flushTask = this.deliverText(plan, buffered, 'sendMarkdown');
            }
            else {
                flushTask = buffer.text.trim() ? buffer.flush() : (buffer.cancel(), Promise.resolve());
                this.buffers.delete(sessionId);
            }
        }
        this.streamAttempts.delete(sessionId);
        const files = this.presentedFiles.get(sessionId) ?? [];
        this.presentedFiles.delete(sessionId);
        this.presentedCalls.delete(sessionId);
        // assistant/message 已在轮内先行发送的文本可能仍在途：与 turn/end 自身的 flush 一起等待
        const pending = this.pendingText.get(sessionId) ?? Promise.resolve();
        this.pendingText.delete(sessionId);
        const failure = extractTurnError(event.reason);
        void (async () => {
            await Promise.all([flushTask, pending]);
            if (plan?.idleWake)
                logProactiveWake(`唤醒回合结束 kind=${event.reason.kind}`);
            if (plan !== undefined && !plan.idleWake && failure !== undefined && !SILENT_TURN_ERROR_CODES.has(failure.code)) {
                await this.send(plan.target, `⚠️ 本轮异常结束\n\`${failure.code}\`: ${failure.message}`, 'sendTurnEndError');
            }
            if (files.length > 0 && this.deliverer !== undefined && plan !== undefined) {
                await this.deliverer.deliver(plan.target, files);
            }
            this.logger.debug(`im-qqbot: turn/end sessionId=${sessionId}`);
        })();
    }
    /** 统一发送：切分 + 逐 chunk 发送 + 错误记录 */
    async send(target, text, tag) {
        const chunks = chunkMarkdownText(text, this.config.textChunkLimit);
        let delivered = chunks.length > 0;
        for (const chunk of chunks) {
            try {
                await this.bot.sendMarkdown(target, chunk);
            }
            catch (err) {
                delivered = false;
                this.logger.error(`im-qqbot: ${tag} failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        return delivered;
    }
}
function eventTurn(data) {
    return Number.isSafeInteger(data.turn) ? data.turn : undefined;
}
/** 按配置组装回合跟踪器（入站登记表需与 handleInbound 共享同一实例） */
export function createTurnTracker(manager, config, logger, inputs = new QqInputRegistry()) {
    return new TurnTracker(manager, inputs, { externalTurns: config.proactiveDelivery?.externalTurns ?? 'c2c' }, logger);
}
/**
 * 创建出站事件处理器
 *
 * 返回 durable 事件与实时流式帧两个入口，分别注册到
 * ctx.on('session/event') 与 ctx.on('agent/assistant-stream', ..., { global: true })。
 * toolsRegistry 用于工具结果的结构化展示；deliverer 用于轮末投递 present 声明的交付文件；
 * tracker 为回合归属的单一事实源，需与提问/审批/发文件共享时由调用方注入。
 */
export function createOutboundHandler(manager, bot, config, logger, toolsRegistry, deliverer, tracker, media) {
    const turns = tracker ?? createTurnTracker(manager, config, logger);
    const router = new OutboundRouter(manager, bot, config, logger, turns, toolsRegistry, deliverer, media);
    return {
        routeSessionEvent: (session, event) => router.route(session, event),
        routeStreamFrame: (agentId, delta) => router.routeStreamFrame(agentId, delta),
    };
}
//# sourceMappingURL=outbound.js.map