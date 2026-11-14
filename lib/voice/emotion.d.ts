/**
 * 情绪标记解析：把 [[情绪:…]] / [情绪:…] 抽成表演指令并从正文删除。
 * 这样角色卡/提示词里可以继续用标记，但不会被念出来。
 */
export declare function extractEmotionMarkers(text: string): {
    text: string;
    instructions: string;
};
//# sourceMappingURL=emotion.d.ts.map