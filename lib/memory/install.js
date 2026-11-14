import { searchMemory } from "./obsidian.js";
const MEMORY_RULE = [
    '',
    '',
    '【长期记忆】',
    '你有一个长期记忆库（Obsidian），存着过去发生的事、约定和人物。',
    '当对方问起过去的事、你们之间的约定、或某个熟人的近况时，先调用 memory_search（query 用关键词，比如「乌龟」「约定 主动来找」），再根据返回的片段回答。',
    '只依据检索到的事实，不要编造；检索不到就直说记不清了。日常寒暄不需要每句都查。',
].join('\n');
/** 给提示词追加“先查记忆”的规则（不改变用户自己写的提示词） */
export function withMemoryPrompt(config) {
    const memory = config.memory;
    if (!memory?.enabled || !memory.promptRule || memory.backend === 'none' || !memory.vaultPath.trim())
        return config;
    const append = (text) => `${text ?? ''}${MEMORY_RULE}`;
    return { ...config, directPrompt: append(config.directPrompt), groupPrompt: append(config.groupPrompt) };
}
/** 注册 memory_search 工具；宿主无 tools 服务时静默跳过（其他功能不受影响） */
export function installMemoryTool(ctx, config, logger) {
    const memory = config.memory;
    if (!memory?.enabled || memory.backend !== 'obsidian' || !memory.vaultPath.trim())
        return;
    const inject = ctx.inject;
    if (typeof inject !== 'function') {
        logger.warn('[memory] ctx.inject 不可用，跳过 memory_search 工具注册');
        return;
    }
    void inject.call(ctx, ['tools'], (scoped) => {
        const tools = scoped.tools;
        if (tools === undefined || typeof tools.register !== 'function')
            return;
        const register = () => {
            const dispose = tools.register({
                name: 'memory_search',
                description: 'Search the user\'s long-term memory vault (Obsidian) for relevant past events, promises, and people. Use it before answering questions about history or relationships. Returns paths, titles, and short snippets only.',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Keywords to search for, e.g. "乌龟 分缸" or "约定 主动来找".' },
                    },
                    required: ['query'],
                },
                output: {
                    schema: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            results: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        path: { type: 'string' },
                                        title: { type: 'string' },
                                        snippet: { type: 'string' },
                                    },
                                },
                            },
                            scanned: { type: 'number' },
                        },
                    },
                    render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
                },
                async execute(args) {
                    const query = String(args.query ?? '').trim();
                    const result = searchMemory(memory, query);
                    logger.debug(`[memory] query="${query}" → ${result.results.length}/${result.scanned} 篇`);
                    return { results: result.results.map(({ path, title, snippet }) => ({ path, title, snippet })), scanned: result.scanned };
                },
            });
            return () => {
                if (typeof dispose === 'function')
                    dispose();
            };
        };
        const effect = ctx.effect;
        if (typeof effect === 'function')
            effect(register);
        else
            register();
    });
}
//# sourceMappingURL=install.js.map