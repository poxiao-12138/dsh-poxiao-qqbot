/**
 * 渠道级语音：私聊回复发送前合成 Breeze 语音条。
 *
 * 设计边界：
 * - 语音是「渠道能力」，不依赖 agent 调工具，也不改用户 preset/persona；
 * - 默认值来自踩坑经验（补标点、尾部静音、淡出、16k 单声道、失败回落文字），
 *   但全部可在 config.voice 里改，不写死；
 * - 凭证复用 qq-voice-polish 设置页保存的 QQ_VOICE_POLISH_BREEZE；
 * - 只在私聊默认开启；群聊需要显式 groupVoice=true。
 */
import { DEFAULT_VOICE_INSTRUCTIONS } from "../shared/voice-defaults.js";
import fs from 'node:fs';
import path from 'node:path';
import { MEDIA_ROOT } from "../media/media-cleaner.js";
import { sendMediaFile } from "../media/send-media.js";
import { readVoiceCredentials } from "./credentials.js";
import { prepareText, synthesizeBreeze } from "./breeze.js";
import { extractEmotionMarkers } from "./emotion.js";
import { polishLine } from "./polish.js";
import { processWav, toMp3, toSilk } from "./audio.js";
/** 语音链路诊断日志：每条回复只记一行，方便排查“为什么没发语音” */
function logVoice(line) {
    try {
        const file = path.join(process.env.HOME ?? '', '.dsh-qqbot', 'voice.log');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.appendFileSync(file, `[${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}] ${line}\n`);
    }
    catch { /* 日志失败不影响发送 */ }
}
/**
 * 逐条语音指令：[[语音]] / [[文字]]（括号可单个）。
 * 只在 auto 模式下作为"这条要不要语音"的依据；任何语音模式都会剥离标记，避免被念出来。
 */
export function extractVoiceDirective(text) {
    let directive = null;
    const cleaned = String(text ?? '')
        .replace(/\[{1,2}\s*(语音|文字)\s*\]{1,2}/g, (_match, value) => {
        directive = value === '语音' ? 'voice' : 'text';
        return '';
    })
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
    return { text: cleaned, directive };
}
const FALLBACK_VOICE_CONFIG = {
    enabled: false, mode: 'text', autoDefault: 'text', groupVoice: false, maxChars: 150,
    fallbackText: true, instructions: DEFAULT_VOICE_INSTRUCTIONS, voiceId: '', apiKey: '',
    baseURL: 'https://api.breeze.blue', timeoutMs: 30000,
    guidanceScale: 2.6, guidanceScaleEmotion: 3.5, fadeMs: 30, padMs: 1000,
    sampleRate: 16000, channels: 1, autoPunctuation: true, emotionMarkers: true,
    polish: false, polishPrompt: '', retries: 2, outputFormat: 'wav',
};
export class VoiceService {
    config;
    logger;
    media;
    cached = null;
    warnedMissing = false;
    constructor(config, logger, media) {
        this.config = config.voice ?? FALLBACK_VOICE_CONFIG;
        this.logger = logger;
        this.media = media;
    }
    /** 该 scope 是否允许发语音（配置 + 凭证都在才允许） */
    applicable(scope) {
        if (!this.config.enabled || this.config.mode === 'text')
            return false;
        if (scope === 'group' && !this.config.groupVoice)
            return false;
        return this.credentials() !== null;
    }
    credentials() {
        const now = Date.now();
        if (this.cached !== null && now - this.cached.at < 30_000)
            return this.cached.credentials;
        let credentials = null;
        if (this.config.apiKey && this.config.voiceId) {
            credentials = { apiKey: this.config.apiKey, voiceId: this.config.voiceId };
        }
        else {
            credentials = readVoiceCredentials();
        }
        if (credentials === null && !this.warnedMissing) {
            this.warnedMissing = true;
            this.logger.warn('[voice] 未找到 Breeze 凭证：先在 qq-voice-polish 设置页填 API Key，或在 config.voice 填 apiKey/voiceId');
        }
        this.cached = { at: now, credentials };
        return credentials;
    }
    /** 文字是否不适合朗读（链接、代码、表格、错误提示、超长） */
    unsuitable(text) {
        if (!text.trim())
            return true;
        if ([...text].length > this.config.maxChars)
            return true;
        if (/https?:\/\//i.test(text))
            return true;
        if (/```|`[^`]+`/.test(text))
            return true;
        if (/^\s*[|>#-]/.test(text))
            return true;
        if (/^⚠️/.test(text.trim()))
            return true;
        return false;
    }
    /** 合成（带重试），返回 wav Buffer */
    async synthesize(text, instructions, credentials) {
        const attempts = Math.max(0, Math.min(5, Math.floor(this.config.retries))) + 1;
        let lastError;
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
            try {
                return await synthesizeBreeze(text, {
                    apiKey: credentials.apiKey,
                    voiceId: this.config.voiceId || credentials.voiceId,
                    baseURL: this.config.baseURL || 'https://api.breeze.blue',
                    instructions,
                    maxChars: this.config.maxChars,
                    gracefulness: this.config.guidanceScale,
                    guidanceScaleEmotion: this.config.guidanceScaleEmotion,
                    timeoutMs: this.config.timeoutMs,
                });
            }
            catch (error) {
                lastError = error;
                if (attempt < attempts)
                    this.logger.warn(`[voice] 合成失败（第 ${attempt} 次），重试：${error instanceof Error ? error.message : String(error)}`);
            }
        }
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }
    /**
     * 尝试把一段文字发成语音；返回是否已经发出去。
     * 管线：情绪标记 → 可选润色 → 补标点 → 合成 → 后处理 → 格式转换 → 发送。
     */
    async sendVoice(bot, target, text, checked = false) {
        const sender = this.media ?? bot;
        if (sender === undefined) {
            logVoice('skip: no media sender');
            return 'skipped';
        }
        if (!this.applicable(target.scope)) {
            logVoice('skip: not applicable (disabled/no credentials/group off)');
            return 'skipped';
        }
        let line = String(text ?? '').trim();
        let instructions = this.config.instructions;
        let hasMarker = false;
        if (this.config.emotionMarkers) {
            const extracted = extractEmotionMarkers(line);
            line = extracted.text;
            hasMarker = Boolean(extracted.instructions);
            if (hasMarker)
                instructions = extracted.instructions;
        }
        if (this.unsuitable(line))
            return 'skipped';
        if (this.config.polish && !checked) {
            const polished = await polishLine(line, instructions, this.config.polishPrompt, this.config.timeoutMs);
            if (polished !== null) {
                line = polished.text;
                if (polished.instructions)
                    instructions = polished.instructions;
            }
        }
        else if (this.config.emotionMarkers && !hasMarker) {
            const direction = await polishLine(line, '', '', Math.min(this.config.timeoutMs, 5000), true);
            if (direction?.instructions)
                instructions = direction.instructions;
        }
        line = this.config.autoPunctuation ? prepareText(line) : line.trim();
        if (this.unsuitable(line)) {
            logVoice(`skip: unsuitable chars=${[...line].length} max=${this.config.maxChars}`);
            return 'skipped';
        }
        const credentials = this.credentials();
        if (credentials === null)
            return 'skipped';
        let files = [];
        try {
            let wav = await this.synthesize(line, instructions, credentials);
            wav = processWav(wav, {
                fadeMs: this.config.fadeMs,
                padMs: this.config.padMs,
                sampleRate: this.config.sampleRate,
                channels: this.config.channels,
            });
            const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
            const send = async (buffer, ext) => {
                fs.mkdirSync(MEDIA_ROOT, { recursive: true });
                const file = path.join(MEDIA_ROOT, `qqbot-voice-${token}.${ext}`);
                fs.writeFileSync(file, buffer, { mode: 0o600 });
                files.push(file);
                const result = await sendMediaFile(sender, target, file);
                return result.outcome === 'sent' ? { ok: true } : { ok: false, error: result.outcome === 'failed' ? result.error : result.outcome };
            };
            const errors = [];
            // QQ 官方语音优先发 SILK（官方推荐格式），失败再回落 wav / mp3
            const silk = await toSilk(wav);
            if (silk !== null) {
                const sent = await send(silk, 'silk');
                if (sent.ok) {
                    logVoice(`sent: silk ${[...line].length} chars`);
                    return 'sent';
                }
                errors.push(`silk: ${sent.error ?? 'unknown'}`);
            }
            else {
                errors.push('silk: encoder unavailable');
            }
            if (this.config.outputFormat === 'mp3') {
                const mp3 = toMp3(wav);
                if (mp3 !== null) {
                    const sent = await send(mp3, 'mp3');
                    if (sent.ok) {
                        logVoice(`sent: mp3 ${[...line].length} chars`);
                        return 'sent';
                    }
                    errors.push(`mp3: ${sent.error ?? 'unknown'}`);
                }
            }
            const wavSend = await send(wav, 'wav');
            if (wavSend.ok) {
                logVoice(`sent: wav ${[...line].length} chars`);
                return 'sent';
            }
            errors.push(`wav: ${wavSend.error ?? 'unknown'}`);
            if (this.config.outputFormat !== 'mp3') {
                const mp3 = toMp3(wav);
                if (mp3 !== null) {
                    const sent = await send(mp3, 'mp3');
                    if (sent.ok) {
                        logVoice(`sent: mp3 fallback ${[...line].length} chars`);
                        return 'sent';
                    }
                    errors.push(`mp3: ${sent.error ?? 'unknown'}`);
                }
            }
            logVoice(`failed: send rejected — ${errors.join(' | ')}`);
            this.logger.warn('[voice] 语音发送未成功');
            return 'failed';
        }
        catch (error) {
            logVoice(`failed: synth error ${error instanceof Error ? error.message : String(error)}`);
            this.logger.warn(`[voice] 合成失败，回落文字：${error instanceof Error ? error.message : String(error)}`);
            return 'failed';
        }
        finally {
            for (const file of files) {
                try {
                    fs.unlinkSync(file);
                }
                catch { /* 清理失败不影响主流程 */ }
            }
        }
    }
}
//# sourceMappingURL=index.js.map