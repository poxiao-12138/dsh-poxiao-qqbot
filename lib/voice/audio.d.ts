/**
 * WAV 后处理：混单声道 → 重采样 → 淡出 → 尾部静音 → 重新编码。
 *
 * 目标是把旧链路的踩坑经验固化：绝不把最后一个字吃掉（补终止标点 + 尾部静音），
 * 结尾不突兀（短淡出），QQ 语音条默认 16k 单声道。
 * 解析失败时原样返回，不阻断发送。
 */
export interface AudioProcessOptions {
    fadeMs: number;
    padMs: number;
    sampleRate: number;
    channels: 1 | 2;
}
interface DecodedWav {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    samples: Float32Array;
}
/** 仅支持 16-bit PCM（Breeze 返回的格式）；其他返回 null 由调用方原样发送 */
export declare function decodeWav(buffer: Buffer): DecodedWav | null;
export declare function encodeWav(samples: Float32Array, sampleRate: number, channels: number): Buffer;
/** 处理失败时返回原 buffer（保底可发） */
export declare function processWav(buffer: Buffer, options: AudioProcessOptions): Buffer;
/** wav → QQ 语音要的 SILK（silk-wasm 编码，24kHz PCM） */
export declare function toSilk(wav: Buffer): Promise<Buffer | null>;
/** wav → mp3（需要 ffmpeg；失败返回 null，由调用方回落 wav） */
export declare function toMp3(wav: Buffer): Buffer | null;
export {};
//# sourceMappingURL=audio.d.ts.map