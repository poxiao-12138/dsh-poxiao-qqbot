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

const HUMMING_MARKER = '[[轻哼]]';
const LEGACY_HUMMING_TAG = '[哼歌]';
export const HUMMING_INSTRUCTIONS = '很轻地哼给自己听，跑调也不在乎，气声多，语速慢';
export const HUMMING_PROMPT = '对方想听你唱两句、哼一段或用歌声哄睡时，用语音轻哼。回复以 [[语音]] 开头，下一行先写 ' + HUMMING_MARKER + ' 再写台词。根据当下情境写一两行短句，可以先哼两声「嗯——嗯——」。直接开始，不加解释或情绪标记，语音插件会配轻哼指令。';

export function extractHummingMarker(text: string): { text: string; humming: boolean } {
  const clean = text.replaceAll(HUMMING_MARKER, '').replaceAll(LEGACY_HUMMING_TAG, '');
  return { text: clean.trim(), humming: clean !== text };
}
