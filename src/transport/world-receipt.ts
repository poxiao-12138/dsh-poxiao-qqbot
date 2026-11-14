const WORLD_PREFIX = 'mcp__dafeiyu-world__';
const ACTIONS: Readonly<Record<string, string>> = {
  pet_pet: '摸过了',
  pet_rename: '改名了',
  water_plant: '浇过水了',
  open_door: '门打开了',
};

export function isCheckedWorldAction(name: string): boolean {
  return name.startsWith(WORLD_PREFIX) && Object.hasOwn(ACTIONS, name.slice(WORLD_PREFIX.length));
}

/** 固定表达只引用已知字段。无法解析的回执也不放行模型对动作结果的猜测。 */
export function checkedWorldReply(name: string, blocks: unknown, failed = false): string {
  const action = ACTIONS[name.slice(WORLD_PREFIX.length)];
  if (failed) return '这次操作没成功。';
  if (Array.isArray(blocks)) {
    for (const block of blocks) {
      const parts = block?.type === 'tool-result' ? block.content : [block];
      for (const part of Array.isArray(parts) ? parts : [{ type: 'text', text: parts }]) {
        if (part?.type !== 'text' || typeof part.text !== 'string') continue;
        try {
          const receipt = JSON.parse(part.text);
          if (receipt?.ok === false) return '这次操作没成功。';
          if (receipt?.ok !== true) continue;
          if (action === ACTIONS.pet_rename && typeof receipt.name === 'string' && /^[\p{L}\p{N} _-]{1,32}$/u.test(receipt.name)) {
            return `改好了，现在叫「${receipt.name}」。`;
          }
          if (receipt.audioAvailable === false) return `${action}，没有音频，听不出响没响。`;
          return `${action}。`;
        } catch { /* 非 JSON 内容不能作为动作回执。 */ }
      }
    }
  }
  return '这次操作的结果还没确认。';
}
