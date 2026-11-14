/**
 * 表情包工具：
 * - qqbot_save_sticker：把收到的图片（media 目录里的附件）存进本地表情库
 * - qqbot_send_sticker：从表情库按名字/标签/随机挑一张，当图片发出去
 *
 * 官方 QQ 机器人不支持原生表情消息，所以表情按图片发送（显示为图片）。
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { atomicWrite } from "../shared/atomic-file.js";
import os from 'node:os';
import path from 'node:path';
import { MEDIA_ROOT } from "./media-cleaner.js";
import { sendMediaFile } from "./send-media.js";
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const INDEX_FILE = 'stickers.json';
function expandHome(input) {
    if (input === '~')
        return os.homedir();
    if (input.startsWith('~/') || input.startsWith('~\\'))
        return path.join(os.homedir(), input.slice(2));
    return input;
}
export function libraryDir(config) {
    const dir = config.stickers?.dir?.trim();
    return dir ? expandHome(dir) : path.join(os.homedir(), '.dsh-qqbot', 'stickers');
}
function loadIndex(dir) {
    try {
        return JSON.parse(fs.readFileSync(path.join(dir, INDEX_FILE), 'utf8'));
    }
    catch {
        return {};
    }
}
function saveIndex(dir, index) {
    fs.mkdirSync(dir, { recursive: true });
    atomicWrite(path.join(dir, INDEX_FILE), [JSON.stringify(index, null, 2)]);
}
function safeName(input, fallback) {
    const base = path.basename(input).replace(/[\u0000-\u001f<>:"|?*\\/]/g, '_').trim();
    return base || fallback;
}
/** Identical bytes share an index entry, including previously migrated images. */
export function createStickerCollector(config) {
    const dir = libraryDir(config);
    const pending = new Set();
    const hash = (data) => createHash('sha256').update(data).digest('hex');
    const alreadySaved = (digest, index) => Object.values(index).some(({ file }) => {
        if (path.basename(file) !== file)
            return false;
        try {
            return hash(fs.readFileSync(path.join(dir, file))) === digest;
        }
        catch {
            return false;
        }
    });
    return async (source, classify, signal) => {
        const ext = path.extname(source).toLowerCase();
        if (!IMAGE_EXT.has(ext) || fs.statSync(source).size > config.vision.maxBytes)
            return;
        const data = fs.readFileSync(source);
        const digest = hash(data);
        if (pending.has(digest) || alreadySaved(digest, loadIndex(dir)))
            return;
        pending.add(digest);
        try {
            const content = await classify();
            signal?.throwIfAborted();
            const result = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ''));
            if (result?.sticker !== true || typeof result.name !== 'string' || !Array.isArray(result.tags))
                return;
            const name = safeName(result.name.slice(0, 30), '');
            const tags = [...new Set(result.tags.filter((tag) => typeof tag === 'string')
                    .map((tag) => tag.trim().slice(0, 24)).filter(Boolean))].slice(0, 10);
            if (!name || !tags.length)
                return;
            const index = loadIndex(dir);
            if (alreadySaved(digest, index))
                return;
            const file = `auto-${digest}${ext}`;
            let label = name;
            for (let suffix = 2; Object.hasOwn(index, label); suffix++)
                label = `${name}（${suffix}）`;
            fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
            try {
                fs.writeFileSync(path.join(dir, file), data, { flag: 'wx', mode: 0o600 });
            }
            catch (error) {
                if (error.code !== 'EEXIST')
                    throw error;
            }
            saveIndex(dir, { ...index, [label]: { file, tags, addedAt: Date.now() } });
        }
        finally {
            pending.delete(digest);
        }
    };
}
function currentTarget(agent, manager, targets) {
    const agentId = agent?.id;
    if (targets !== undefined && typeof agentId === 'string' && agentId)
        return targets.targetFor(agentId);
    return manager.findByAgent(agent)?.replyTarget;
}
function parseTarget(input) {
    const idx = input.indexOf(':');
    if (idx <= 0)
        return undefined;
    const scope = input.slice(0, idx);
    const targetId = input.slice(idx + 1);
    if (!targetId || (scope !== 'c2c' && scope !== 'group'))
        return undefined;
    return { scope: scope, targetId };
}
export function registerStickerTools(ctx, bot, manager, config, logger, targets) {
    if (config.stickers?.enabled === false)
        return;
    const tools = ctx.get('tools');
    if (tools?.register === undefined)
        return;
    const dir = libraryDir(config);
    tools.register({
        name: 'qqbot_save_sticker',
        description: 'Save an image the user sent (a sticker or picture) into the local sticker library so it can be sent again later. The source must be an image downloaded into the media directory (the path is in the conversation context).',
        parameters: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Absolute path of the received image (under the media directory).' },
                name: { type: 'string', description: 'Optional short name used later to send it back.' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags for search, e.g. ["开心","猫"].' },
            },
            required: ['file_path'],
            additionalProperties: false,
        },
        output: {
            schema: { type: 'object', properties: { name: { type: 'string' }, file: { type: 'string' } }, required: ['name', 'file'], additionalProperties: false },
            render: (_a, v) => [{ type: 'text', text: `已保存表情 ${v.name}` }],
        },
        async execute(args) {
            const { file_path, name, tags } = args;
            const source = typeof file_path === 'string' ? path.resolve(file_path) : '';
            if (!source)
                throw new Error('qqbot_save_sticker: 需要 file_path');
            if (!source.startsWith(path.resolve(MEDIA_ROOT) + path.sep) && !source.startsWith(path.resolve(dir) + path.sep)) {
                throw new Error('qqbot_save_sticker: 只允许保存 media 目录或表情库里的图片');
            }
            if (!fs.existsSync(source) || !IMAGE_EXT.has(path.extname(source).toLowerCase())) {
                throw new Error('qqbot_save_sticker: 文件不存在或不是图片（png/jpg/jpeg/gif/webp）');
            }
            fs.mkdirSync(dir, { recursive: true });
            const displayName = typeof name === 'string' && name.trim() ? name.trim() : path.basename(source, path.extname(source));
            const fileName = `${Date.now()}-${safeName(displayName, 'sticker')}${path.extname(source).toLowerCase()}`;
            const dest = path.join(dir, fileName);
            fs.copyFileSync(source, dest);
            const index = loadIndex(dir);
            index[displayName] = { file: fileName, tags: Array.isArray(tags) ? tags.map(String).slice(0, 10) : [], addedAt: Date.now() };
            saveIndex(dir, index);
            logger.info(`im-qqbot: 表情已保存 ${displayName} → ${dest}`);
            return { name: displayName, file: dest };
        },
    });
    tools.register({
        name: 'qqbot_list_stickers',
        description: 'List stickers available in the local sticker library with their names and tags. Call this before choosing a sticker to send, then pick the one that fits the current mood or context.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        output: {
            schema: {
                type: 'object',
                properties: {
                    stickers: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: { name: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } },
                            required: ['name', 'tags'], additionalProperties: false,
                        },
                    },
                },
                required: ['stickers'], additionalProperties: false,
            },
            render: (_a, v) => {
                const list = v.stickers;
                return [{ type: 'text', text: list.length === 0 ? '表情库为空' : `表情库（${list.length}）：${list.map((item) => item.name).join('、')}` }];
            },
        },
        async execute() {
            const index = loadIndex(dir);
            const stickers = Object.entries(index)
                .filter(([, entry]) => fs.existsSync(path.join(dir, entry.file)))
                .map(([name, entry]) => ({ name, tags: entry.tags }));
            return { stickers };
        },
    });
    tools.register({
        name: 'qqbot_send_sticker',
        description: 'Send one specific sticker from the local sticker library as an image message. Choose by name (substring) or tags, based on the current conversation mood. Call qqbot_list_stickers first when unsure what is available. Do not send stickers at random or in bulk.',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Sticker name or substring, chosen deliberately for this moment.' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags to narrow the choice (e.g. ["开心","猫"]).' },
                target: { type: 'string', description: 'Optional "c2c:openid" / "group:openid"; defaults to current conversation.' },
            },
            additionalProperties: false,
        },
        output: {
            schema: { type: 'object', properties: { name: { type: 'string' }, file: { type: 'string' } }, required: ['name', 'file'], additionalProperties: false },
            render: (_a, v) => [{ type: 'text', text: `已发送表情 ${v.name}` }],
        },
        async execute(args, exec) {
            const { name, tags, target } = (args ?? {});
            if ((typeof name !== 'string' || !name.trim()) && !(Array.isArray(tags) && tags.length > 0)) {
                throw new Error('qqbot_send_sticker: 请先用 qqbot_list_stickers 看库存，再按名字或标签选一张（不支持随机发送）');
            }
            const index = loadIndex(dir);
            const entries = Object.entries(index).filter(([, entry]) => fs.existsSync(path.join(dir, entry.file)));
            if (entries.length === 0)
                throw new Error('qqbot_send_sticker: 表情库为空，先用 qqbot_save_sticker 存几张');
            const wantedTags = Array.isArray(tags) ? tags.map(String) : [];
            let pool = entries;
            if (typeof name === 'string' && name.trim())
                pool = pool.filter(([key]) => key.includes(name.trim()));
            if (wantedTags.length > 0)
                pool = pool.filter(([, entry]) => wantedTags.every((tag) => entry.tags.includes(tag)));
            if (pool.length === 0)
                throw new Error('qqbot_send_sticker: 没有匹配的表情，请换名字/标签或先存图');
            const [pickedName, picked] = pool[0];
            let replyTarget;
            if (typeof target === 'string' && target) {
                replyTarget = parseTarget(target);
                if (replyTarget === undefined)
                    throw new Error('qqbot_send_sticker: target 格式错误');
            }
            else {
                replyTarget = currentTarget(exec.agent, manager, targets);
            }
            if (replyTarget === undefined)
                throw new Error('qqbot_send_sticker: 无法确定发送目标');
            const file = path.join(dir, picked.file);
            const result = await sendMediaFile(bot, replyTarget, file);
            if (result.outcome !== 'sent')
                throw new Error(`qqbot_send_sticker: 发送失败（${result.outcome}）`);
            logger.info(`im-qqbot: 表情已发送 ${pickedName}`);
            return { name: pickedName, file };
        },
    });
    logger.info('im-qqbot: 表情包工具已注册');
}
//# sourceMappingURL=sticker-tools.js.map