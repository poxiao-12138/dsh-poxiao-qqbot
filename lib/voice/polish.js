/**
 * 可选台词润色：默认关闭；打开后调用 DeepSeek 把台词口语化并生成表演指令。
 * 失败/无 key 时返回 null，由调用方用原文合成（绝不因润色失败而丢消息）。
 */
import { readDeepSeekKey } from "./credentials.js";
const BASE_PROMPT = [
    '你是语音台词编辑。只输出一个 JSON 对象，字段是 text 和 instructions，均为字符串。',
    '保持原意、称呼、事实、承诺、否定、数字和链接；只做轻微口语化和语气词调整，不新增故事或改变立场。',
    'instructions 按「情境＋说话意图＋语气重点」写一条 65 字以内的表演指令。根据台词和已有指令判断；情境不明确时保持自然，不补写未知前情。台词和表演方向要一致。',
    '不要输出 Markdown、不要解释。',
].join('\n');
export async function polishLine(text, instructions, customPrompt, timeoutMs = 20000) {
    const key = readDeepSeekKey();
    if (key === null)
        return null;
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
                        content: `${BASE_PROMPT}${customPrompt.trim() ? `\n\n补充风格（遵循以上规则）：${customPrompt.trim()}` : ''}\n\n待处理：${JSON.stringify({ 待发台词: text, 已有表演指令: instructions })}`,
                    }],
            }),
            signal: AbortSignal.timeout(Math.max(5000, timeoutMs)),
        });
        if (!res.ok)
            return null;
        const json = await res.json();
        const raw = json.choices?.[0]?.message?.content ?? '';
        const body = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(body);
        if (typeof parsed.text !== 'string' || !parsed.text.trim())
            return null;
        return {
            text: parsed.text.trim(),
            instructions: typeof parsed.instructions === 'string' ? parsed.instructions.trim() : '',
        };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=polish.js.map