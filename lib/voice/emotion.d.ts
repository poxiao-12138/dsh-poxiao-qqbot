/**
 * 情绪标记解析：把 [[情绪:…]] / [情绪:…] 抽成表演指令并从正文删除。
 * 这样角色卡/提示词里可以继续用标记，但不会被念出来。
 */
export declare function extractEmotionMarkers(text: string): {
    text: string;
    instructions: string;
};
export declare const HUMMING_INSTRUCTIONS = "\u5F88\u8F7B\u5730\u54FC\u7ED9\u81EA\u5DF1\u542C\uFF0C\u8DD1\u8C03\u4E5F\u4E0D\u5728\u4E4E\uFF0C\u6C14\u58F0\u591A\uFF0C\u8BED\u901F\u6162";
export declare const HUMMING_PROMPT: string;
export declare function extractHummingMarker(text: string): {
    text: string;
    humming: boolean;
};
//# sourceMappingURL=emotion.d.ts.map