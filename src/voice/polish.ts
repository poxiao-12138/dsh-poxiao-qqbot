/**
 * 可选台词润色：默认关闭；打开后调用 DeepSeek 把台词口语化并生成表演指令。
 * 失败/无 key 时返回 null，由调用方用原文合成（绝不因润色失败而丢消息）。
 */
import { readDeepSeekKey } from './credentials.ts';

const BASE_PROMPT = [
  '你是语音台词编辑。只输出一个 JSON 对象，字段是 text 和 instructions，均为字符串。',
  '保持原意、称呼、事实、承诺、否定、数字和链接；只做轻微口语化和语气词调整，不新增故事或改变立场。',
  '先定台词。只依据台词和已有指令理解这句要表达的反应。若原句只是复述或陈述，可以调整句式、用词或标点，让反应从台词里听出来。台词已经能传达态度时原样保留。证据不足时保持自然，保留原意和立场。',
  '定稿前核对每个分句是谁做什么。若省略后可能把动作听成另一个人做，而原台词或已有指令已明确对象，必须把这个称呼或代词放进台词。这属于澄清原意。没有依据时不猜。按口语的意思分句，连贯的短语别用标点拆开。',
  '台词定稿后，instructions 按「情境＋说话意图＋语气重点」写一条 65 字以内的表演指令，只给一个听得见的变化，并与定稿的台词一致。不要借指令加戏或改变情绪方向。',
  '不要输出 Markdown、不要解释。',
].join('\n');

export interface PolishResult { text: string; instructions: string }

export async function polishLine(
  text: string,
  instructions: string,
  customPrompt: string,
  timeoutMs = 20000,
  instructionsOnly = false,
): Promise<PolishResult | null> {
  const key = readDeepSeekKey();
  if (key === null) return null;
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.6,
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `${BASE_PROMPT}${instructionsOnly ? '\n本次只补表演指令。text 必须原样返回，不能重写。根据台词里听得出来的态度给指令；普通应答留空，语气不明时别猜。只描述台词明确的反应，不把听说写成亲眼所见，不推断未交代的前情。只选一个语气重点。' : ''}${customPrompt.trim() ? `\n\n补充风格（遵循以上规则）：${customPrompt.trim()}` : ''}\n\n待处理：${JSON.stringify({ 待发台词: text, 已有表演指令: instructions })}`,
        }],
      }),
      signal: AbortSignal.timeout(Math.max(5000, timeoutMs)),
    });
    if (!res.ok) return null;
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? '';
    const body = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(body) as { text?: unknown; instructions?: unknown };
    if (typeof parsed.text !== 'string' || !parsed.text.trim()) return null;
    return {
      text: instructionsOnly ? text : parsed.text.trim(),
      instructions: typeof parsed.instructions === 'string' ? parsed.instructions.trim() : '',
    };
  } catch {
    return null;
  }
}
