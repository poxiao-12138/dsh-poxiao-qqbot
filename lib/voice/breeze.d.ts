/**
 * BreezeBlue TTS 合成（与 qq-voice-polish/breeze.mjs 同一套 API 约定）。
 * 这里自带一份最小实现，避免集成版对 qq-voice-polish 包产生安装依赖。
 */
export declare function prepareText(text: string): string;
export interface BreezeOptions {
    apiKey: string;
    voiceId: string;
    baseURL?: string;
    model?: string;
    languageCode?: string;
    instructions?: string;
    maxChars?: number;
    gracefulness?: number;
    guidanceScaleEmotion?: number;
    timeoutMs?: number;
}
export declare function synthesizeBreeze(text: string, { apiKey, voiceId, baseURL, model, languageCode, instructions, maxChars, gracefulness, guidanceScaleEmotion, timeoutMs, }: BreezeOptions): Promise<Buffer>;
//# sourceMappingURL=breeze.d.ts.map