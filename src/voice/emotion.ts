/**
 * 情绪标记解析：把 [[情绪:…]] / [情绪:…] 抽成表演指令并从正文删除。
 * 这样角色卡/提示词里可以继续用标记，但不会被念出来。
 */
export function extractEmotionMarkers(text: string): { text: string; instructions: string } {
  const found: string[] = [];
  const cleaned = text
    .replace(/\[{1,2}\s*情绪\s*[:：]\s*([^\]\n]{1,120})\]{1,2}/g, (_match, inner: string) => {
      const value = String(inner).trim();
      if (value) found.push(value);
      return '';
    })
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+\n/g, '\n')
    .trim();
  return { text: cleaned, instructions: found.join('；') };
}
