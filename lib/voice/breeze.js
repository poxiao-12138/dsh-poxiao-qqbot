/**
 * BreezeBlue TTS 合成（与 qq-voice-polish/breeze.mjs 同一套 API 约定）。
 * 这里自带一份最小实现，避免集成版对 qq-voice-polish 包产生安装依赖。
 */
export function prepareText(text) {
    let clean = String(text ?? '').replace(/\s+/g, ' ').trim();
    if (!clean)
        return '';
    if (!/[。！？!?….]$/.test(clean) && !/\]$/.test(clean))
        clean += '。';
    return clean;
}
export async function synthesizeBreeze(text, { apiKey, voiceId, baseURL = 'https://api.breeze.blue', model = 'breeze-tts-2-multilingual', languageCode = 'zh', instructions = '', maxChars = 300, gracefulness = 2.6, guidanceScaleEmotion = 3.5, timeoutMs = 30000, }) {
    if (!apiKey)
        throw new Error('缺少 Breeze API Key');
    const clean = prepareText(text);
    if (!clean)
        throw new Error('要念的文字为空');
    if (clean.length > maxChars)
        throw new Error(`文字太长（${clean.length} 字，上限 ${maxChars}）`);
    const body = {
        text: clean,
        model_id: model,
        language_code: languageCode,
    };
    const merged = String(instructions ?? '').trim();
    if (merged)
        body.instructions = merged;
    body.voice_settings = { guidance_scale: merged ? guidanceScaleEmotion : gracefulness, use_speaker_boost: false };
    const res = await fetch(`${baseURL.replace(/\/+$/, '')}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=wav`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Math.max(5000, Number(timeoutMs) || 30000)),
    });
    if (!res.ok) {
        const raw = await res.text().catch(() => '');
        throw new Error(`Breeze HTTP ${res.status}: ${raw.slice(0, 200)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length)
        throw new Error('Breeze 没有返回音频数据');
    return buf;
}
//# sourceMappingURL=breeze.js.map