/**
 * WAV 后处理：混单声道 → 重采样 → 淡出 → 尾部静音 → 重新编码。
 *
 * 目标是把旧链路的踩坑经验固化：绝不把最后一个字吃掉（补终止标点 + 尾部静音），
 * 结尾不突兀（短淡出），QQ 语音条默认 16k 单声道。
 * 解析失败时原样返回，不阻断发送。
 */
import { spawnSync } from 'node:child_process';
function readUint32(view, offset) {
    return view.getUint32(offset, true);
}
/** 仅支持 16-bit PCM（Breeze 返回的格式）；其他返回 null 由调用方原样发送 */
export function decodeWav(buffer) {
    if (buffer.length < 44)
        return null;
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE')
        return null;
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    let offset = 12;
    let channels = 0;
    let sampleRate = 0;
    let bitsPerSample = 0;
    let dataOffset = -1;
    let dataLength = 0;
    while (offset + 8 <= buffer.length) {
        const id = buffer.toString('ascii', offset, offset + 4);
        const size = readUint32(view, offset + 4);
        const body = offset + 8;
        if (id === 'fmt ' && size >= 16) {
            channels = view.getUint16(body + 2, true);
            sampleRate = readUint32(view, body + 4);
            bitsPerSample = view.getUint16(body + 14, true);
        }
        else if (id === 'data') {
            dataOffset = body;
            dataLength = Math.min(size, buffer.length - body);
            break;
        }
        offset = body + size + (size % 2);
    }
    if (channels === 0 || sampleRate === 0 || dataOffset < 0)
        return null;
    if (bitsPerSample !== 16)
        return null;
    const frameCount = Math.floor(dataLength / (2 * channels));
    const samples = new Float32Array(frameCount * channels);
    for (let i = 0; i < frameCount * channels; i += 1) {
        samples[i] = view.getInt16(dataOffset + i * 2, true) / 32768;
    }
    return { sampleRate, channels, bitsPerSample, samples };
}
/** 线性重采样（语音够用；避免引入原生依赖） */
function resample(input, channels, fromRate, toRate) {
    if (fromRate === toRate)
        return input;
    const frames = Math.floor(input.length / channels);
    const outFrames = Math.max(1, Math.round(frames * toRate / fromRate));
    const out = new Float32Array(outFrames * channels);
    for (let frame = 0; frame < outFrames; frame += 1) {
        const pos = frame * fromRate / toRate;
        const i0 = Math.min(frames - 1, Math.floor(pos));
        const i1 = Math.min(frames - 1, i0 + 1);
        const frac = pos - i0;
        for (let ch = 0; ch < channels; ch += 1) {
            const a = input[i0 * channels + ch] ?? 0;
            const b = input[i1 * channels + ch] ?? 0;
            out[frame * channels + ch] = a + (b - a) * frac;
        }
    }
    return out;
}
/** 单声道取平均；已是目标声道数时不动 */
function mixChannels(input, fromChannels, toChannels) {
    if (fromChannels === toChannels)
        return input;
    const frames = Math.floor(input.length / fromChannels);
    const out = new Float32Array(frames * toChannels);
    for (let frame = 0; frame < frames; frame += 1) {
        if (toChannels === 1) {
            let sum = 0;
            for (let ch = 0; ch < fromChannels; ch += 1)
                sum += input[frame * fromChannels + ch] ?? 0;
            out[frame] = sum / fromChannels;
        }
        else {
            for (let ch = 0; ch < toChannels; ch += 1)
                out[frame * toChannels + ch] = input[frame * fromChannels + (ch % fromChannels)] ?? 0;
        }
    }
    return out;
}
export function encodeWav(samples, sampleRate, channels) {
    const dataSize = samples.length * 2;
    const buffer = Buffer.alloc(44 + dataSize);
    buffer.write('RIFF', 0, 'ascii');
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8, 'ascii');
    buffer.write('fmt ', 12, 'ascii');
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * channels * 2, 28);
    buffer.writeUInt16LE(channels * 2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36, 'ascii');
    buffer.writeUInt32LE(dataSize, 40);
    for (let i = 0; i < samples.length; i += 1) {
        const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
        buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
    }
    return buffer;
}
/** 处理失败时返回原 buffer（保底可发） */
export function processWav(buffer, options) {
    const decoded = decodeWav(buffer);
    if (decoded === null)
        return buffer;
    let samples = mixChannels(decoded.samples, decoded.channels, options.channels);
    samples = resample(samples, options.channels, decoded.sampleRate, options.sampleRate);
    const frames = Math.floor(samples.length / options.channels);
    // 尾部淡出：只影响最后 fadeMs，避免“啪”的截断感
    const fadeFrames = Math.min(frames, Math.round(options.sampleRate * (options.fadeMs / 1000)));
    if (fadeFrames > 0) {
        for (let frame = frames - fadeFrames; frame < frames; frame += 1) {
            const gain = (frames - frame) / fadeFrames;
            for (let ch = 0; ch < options.channels; ch += 1) {
                const index = frame * options.channels + ch;
                samples[index] = (samples[index] ?? 0) * gain;
            }
        }
    }
    // 尾部静音：补在淡出之后，保证模型/播放器不会提前截断
    const padFrames = Math.max(0, Math.round(options.sampleRate * (options.padMs / 1000)));
    const output = new Float32Array(samples.length + padFrames * options.channels);
    output.set(samples, 0);
    return encodeWav(output, options.sampleRate, options.channels);
}
/** wav → QQ 语音要的 SILK（silk-wasm 编码，24kHz PCM） */
export async function toSilk(wav) {
    const decoded = decodeWav(wav);
    if (decoded === null)
        return null;
    try {
        const silkModule = await import('silk-wasm');
        // 先混单声道并重采样到 24k（silk 编码器约定）
        const mono = mixChannels(decoded.samples, decoded.channels, 1);
        const resampled = resample(mono, 1, decoded.sampleRate, 24000);
        const pcm = Buffer.alloc(resampled.length * 2);
        for (let i = 0; i < resampled.length; i += 1) {
            const clamped = Math.max(-1, Math.min(1, resampled[i] ?? 0));
            pcm.writeInt16LE(Math.round(clamped * 32767), i * 2);
        }
        const encoded = await silkModule.encode(new Uint8Array(pcm), 24000);
        if (encoded?.data === undefined || encoded.data.length === 0)
            return null;
        return Buffer.from(encoded.data);
    }
    catch {
        return null;
    }
}
/** wav → mp3（需要 ffmpeg；失败返回 null，由调用方回落 wav） */
export function toMp3(wav) {
    const candidates = ['ffmpeg', 'ffmpeg.exe', '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'];
    for (const bin of candidates) {
        const result = spawnSync(bin, ['-hide_banner', '-loglevel', 'error', '-f', 'wav', '-i', 'pipe:0', '-codec:a', 'libmp3lame', '-q:a', '4', '-f', 'mp3', 'pipe:1'], {
            input: wav,
            maxBuffer: 64 * 1024 * 1024,
        });
        if (result.error !== undefined)
            continue; // 该路径没有 ffmpeg，试下一个
        if (result.status === 0 && result.stdout && result.stdout.length > 0)
            return Buffer.from(result.stdout);
        return null; // ffmpeg 存在但转码失败
    }
    return null;
}
//# sourceMappingURL=audio.js.map