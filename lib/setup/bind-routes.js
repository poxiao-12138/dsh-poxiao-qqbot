import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRelease } from "./release-check.js";
import { persistCredentialsToProfile, removeCredentialsFromProfile, updateProfileConfig, readProfileAccessSnapshot, AccessConfigConflict, } from "./persist.js";
import { getProfileDir, PLUGIN_HOME } from "../shared/index.js";
import { DEFAULT_PERSONA } from "../persona/templates.js";
import { runOrganizerNow } from "../memory/organizer.js";
import { readVoiceCredentials, saveVoiceCredentials } from "../voice/credentials.js";
import { synthesizeBreeze } from "../voice/breeze.js";
import { processWav } from "../voice/audio.js";
import { AccessControlSchema, MemorySchema, StickerSchema, VoiceSchema } from "../config.js";
import { BIND_CONFIG_PATH, RELEASE_CHECK_PATH, BIND_MANUAL_PATH, BIND_REFRESH_PATH, BIND_STATE_PATH, BIND_UNBIND_PATH, PERSONA_PATH, PRESETS_PATH, ORGANIZE_PATH, VOICE_CREDENTIAL_PATH, VOICE_PREVIEW_PATH, VOICE_SAMPLE_PATH, } from "../shared/bind-protocol.js";
// 协议单一来源：shared/bind-protocol.ts（类型 + 路径常量，客户端共用）
export { BIND_CONFIG_PATH, BIND_MANUAL_PATH, BIND_REFRESH_PATH, BIND_STATE_PATH, BIND_UNBIND_PATH };
/** 可经 UI 编辑的配置键（白名单：只收用户必要的字段，其余走 patch/env） */
const EDITABLE_CONFIG_KEYS = new Set([
    'requireMention', 'streaming', 'showToolResults', 'debug', 'wakeBatchSeconds', 'proactiveWakeEnabled',
    'provider', 'model', 'preset',
    'groupPrompt', 'directPrompt',
    'voice',
    'memory',
    'stickers',
    'access',
]);
/** 白名单键的子 Schema（服务端校验：客户端校验仅为体验，安全边界在宿主） */
const EDITABLE_CONFIG_SCHEMAS = {
    requireMention: (v) => booleanSchema(v, 'requireMention'),
    proactiveWakeEnabled: (v) => booleanSchema(v, 'proactiveWakeEnabled'),
    wakeBatchSeconds: (v) => {
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 30)
            throw new TypeError('合并窗口须为 0 到 30 秒的整数');
        return v;
    },
    streaming: (v) => booleanSchema(v, 'streaming'),
    showToolResults: (v) => booleanSchema(v, 'showToolResults'),
    debug: (v) => booleanSchema(v, 'debug'),
    provider: stringSchema('provider'),
    model: stringSchema('model'),
    preset: stringSchema('preset'),
    groupPrompt: stringSchema('groupPrompt'),
    directPrompt: stringSchema('directPrompt'),
    voice: (v) => VoiceSchema(v),
    memory: (v) => MemorySchema(v),
    stickers: (v) => StickerSchema(v),
    access: (v) => AccessControlSchema(v),
};
function booleanSchema(value, name) {
    if (typeof value !== 'boolean')
        throw new TypeError(`${name} 必须是布尔值`);
    return value;
}
function stringSchema(name) {
    return (value) => {
        if (typeof value !== 'string')
            throw new TypeError(`${name} 必须是字符串`);
        if (value.length > 20000)
            throw new TypeError(`${name} 过长`);
        return value;
    };
}
/** manual 请求体大小上限（appId + appSecret 远小于此值） */
const MAX_MANUAL_BODY_BYTES = 4096;
/**
 * config 请求体大小上限：对齐 Schema 的业务边界——白名单字符串字段单个
 * 允许 20000 字符（全中文 UTF-8 约 60KB），allowlist 不设条目上限（openid
 * 短标识，512KB 约容纳 1.4 万条）。上限只是反滥用闸门，语义校验在 Schema。
 */
const MAX_CONFIG_BODY_BYTES = 512 * 1024;
/**
 * 注册绑定路由（状态查询 / 刷新二维码 / 手动凭据）。
 *
 * @param webServer - ctx.webServer
 * @param service - 绑定状态机；已绑定 fiber 传 null（无扫码流程）
 * @param logger - 日志
 * @param options - 行为注入（bound 态回显、manual 处理）
 * @returns 注销函数（与插件 fiber 生命周期绑定）
 */
export function registerBindRoutes(webServer, service, logger, options = {}) {
    const defaultManual = (credentials) => {
        const persisted = persistCredentialsToProfile(credentials, getProfileDir() ?? undefined, logger);
        return persisted ? { persisted: true } : { persisted: false, error: '无法定位 profile 目录或写入失败，请改用环境变量配置' };
    };
    const handleManualSubmit = options.onManualCredentials ?? defaultManual;
    let active = true;
    const isActive = () => active;
    const disposers = [
        webServer.register({
            kind: 'exact',
            path: RELEASE_CHECK_PATH,
            handler: async (req, res) => {
                if (!trusted(req))
                    return sendJson(res, 403, { error: 'forbidden' });
                if (req.method !== 'GET')
                    return sendJson(res, 405, { error: 'method not allowed' });
                try {
                    sendJson(res, 200, { update: await checkRelease() });
                }
                catch {
                    sendJson(res, 502, { error: '版本检查失败' });
                }
            },
        }),
        webServer.register({
            kind: 'exact',
            path: BIND_STATE_PATH,
            handler: (req, res) => { handleState(req, res, service, options); },
        }),
        webServer.register({
            kind: 'exact',
            path: BIND_REFRESH_PATH,
            handler: (req, res) => { handleRefresh(req, res, service); },
        }),
        webServer.register({
            kind: 'exact',
            path: BIND_MANUAL_PATH,
            handler: (req, res) => handleManual(req, res, handleManualSubmit, isActive),
        }),
        webServer.register({
            kind: 'exact',
            path: BIND_UNBIND_PATH,
            handler: (req, res) => handleUnbind(req, res, options),
        }),
        webServer.register({
            kind: 'exact',
            path: BIND_CONFIG_PATH,
            handler: (req, res) => handleConfig(req, res, options, isActive),
        }),
        webServer.register({
            kind: 'exact',
            path: PERSONA_PATH,
            handler: (req, res) => handlePersona(req, res, options, isActive),
        }),
        webServer.register({
            kind: 'exact',
            path: PRESETS_PATH,
            handler: (req, res) => handlePresets(req, res, options, isActive),
        }),
        webServer.register({
            kind: 'exact',
            path: ORGANIZE_PATH,
            handler: (req, res) => handleOrganize(req, res, options, isActive),
        }),
        webServer.register({
            kind: 'exact',
            path: VOICE_CREDENTIAL_PATH,
            handler: (req, res) => handleVoiceCredential(req, res, isActive),
        }),
        webServer.register({
            kind: 'exact',
            path: VOICE_PREVIEW_PATH,
            handler: (req, res) => handleVoicePreview(req, res, isActive),
        }),
        webServer.register({
            kind: 'exact',
            path: VOICE_SAMPLE_PATH,
            handler: (req, res) => handleVoiceSample(req, res),
        }),
    ];
    logger.info(`im-qqbot: 端内绑定页已就绪: ${BIND_STATE_PATH}`);
    return () => {
        active = false;
        for (const dispose of disposers)
            dispose();
    };
}
/**
 * 请求来源校验（最小 CSRF 防护）。
 *
 * 带 Origin 的请求必须与 Host 同源；同源 fetch 与 Desktop IPC 桥
 * （后者会删除 origin 头）均放行。本路由数据不敏感且动作无害，
 * 该级别的防护足够。
 */
function trusted(req) {
    const origin = req.headers.origin;
    if (origin === undefined)
        return true;
    try {
        return new URL(origin).host === req.headers.host;
    }
    catch {
        return false;
    }
}
function sendJson(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
    });
    res.end(payload);
}
function handleState(req, res, service, options) {
    if (!trusted(req)) {
        sendJson(res, 403, { error: 'forbidden' });
        return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendJson(res, 405, { error: 'method not allowed' });
        return;
    }
    // 已绑定优先（appSecret 不回传，appId 非机密可回显）
    const boundAppId = options.boundAppId?.() ?? null;
    if (boundAppId !== null) {
        sendJson(res, 200, { phase: 'bound', appId: boundAppId });
        return;
    }
    sendJson(res, 200, service === null ? { phase: 'starting' } : service.wireState());
}
function handleRefresh(req, res, service) {
    if (!trusted(req)) {
        sendJson(res, 403, { error: 'forbidden' });
        return;
    }
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' });
        return;
    }
    // 丢弃可能的请求体（refresh 无参数）
    req.resume();
    service?.refresh();
    // 新二维码异步生成，统一由状态轮询收敛
    sendJson(res, 200, { phase: 'starting' });
}
/** 读取并解析 JSON 请求体（带大小上限） */
async function readJsonBody(req, maxBytes = MAX_MANUAL_BODY_BYTES) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        const buffer = chunk;
        size += buffer.length;
        if (size > maxBytes)
            throw new Error('request body too large');
        chunks.push(buffer);
    }
    if (size === 0)
        throw new Error('empty request body');
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
/** 校验手动提交的凭据形态（不打印内容） */
function parseCredentials(body) {
    if (typeof body !== 'object' || body === null)
        return null;
    const record = body;
    const appId = typeof record.appId === 'string' ? record.appId.trim() : '';
    const appSecret = typeof record.appSecret === 'string' ? record.appSecret.trim() : '';
    if (appId.length === 0 || appSecret.length === 0)
        return null;
    if (appId.length > 128 || appSecret.length > 256)
        return null;
    return { appId, appSecret };
}
async function handleManual(req, res, submit, isActive) {
    if (!trusted(req)) {
        sendJson(res, 403, { error: 'forbidden' });
        return;
    }
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' });
        return;
    }
    let body;
    try {
        body = await readJsonBody(req);
    }
    catch (err) {
        sendJson(res, 400, { ok: false, error: `invalid request body: ${err instanceof Error ? err.message : String(err)}` });
        return;
    }
    if (!isActive()) {
        sendJson(res, 503, { ok: false, error: 'QQ 插件已重载，请刷新后重试。' });
        return;
    }
    const credentials = parseCredentials(body);
    if (credentials === null) {
        sendJson(res, 400, { ok: false, error: 'appId 与 appSecret 不能为空' });
        return;
    }
    const result = submit(credentials);
    if (!result.persisted) {
        sendJson(res, 500, { ok: false, error: result.error ?? '保存失败' });
        return;
    }
    // 写入 profile patch 触发 HMR 重载，新 fiber 以新凭据启动网关
    sendJson(res, 200, { ok: true, message: '凭据已保存，插件将自动重载' });
}
/** 解绑：仅已绑定态可执行；移除 profile patch 中的凭据并触发 HMR 重载 */
function handleUnbind(req, res, options) {
    if (!trusted(req)) {
        sendJson(res, 403, { error: 'forbidden' });
        return;
    }
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' });
        return;
    }
    req.resume();
    if ((options.boundAppId?.() ?? null) === null) {
        sendJson(res, 409, { ok: false, error: '当前未绑定' });
        return;
    }
    const result = options.onUnbind === undefined
        ? (() => {
            const removed = removeCredentialsFromProfile(getProfileDir() ?? undefined, undefined);
            if (removed) {
                // 清除进程内凭据：扫码绑定成功时会写入 env（供热更新后的下次
                // apply 兜底读取）；不清则 HMR 重载后新 fiber 仍从 env 读到
                // 凭据，解绑不生效（状态一直停留在 bound）
                delete process.env.QQBOT_APPID;
                delete process.env.QQBOT_SECRET;
            }
            return removed
                ? { persisted: true }
                : { persisted: false, error: '无法定位 profile 目录或写入失败，请手动编辑 cordis.patch.yml' };
        })()
        : options.onUnbind();
    if (!result.persisted) {
        sendJson(res, 500, { ok: false, error: result.error ?? '解绑失败' });
        return;
    }
    // 移除后写入触发 HMR 重载，插件回到未绑定态（绑定流程重新可用）
    sendJson(res, 200, { ok: true, message: '已解绑，插件将重载并重新进入绑定流程' });
}
/**
 * 配置读写：
 * - GET：回显当前生效配置（appSecret 剔除，cwd 等只读字段正常返回）
 * - POST：白名单 + 子 Schema 校验 → 最小写入 profile patch → HMR 重载
 */
async function handleConfig(req, res, options, isActive) {
    if (!trusted(req)) {
        sendJson(res, 403, { error: 'forbidden' });
        return;
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' });
        return;
    }
    if (req.method === 'GET') {
        const current = options.currentConfig?.() ?? {};
        // 不返回 appSecret；memory 仅回显本插件 schema 形状（旧版 qdrant 后端配置剔除）。
        const { appSecret: _s, memory: _rawMemory, ...safe } = current;
        const isSupportedMemory = _rawMemory !== null && typeof _rawMemory === 'object'
            && ('enabled' in _rawMemory || 'backend' in _rawMemory);
        const memoryView = isSupportedMemory ? MemorySchema(_rawMemory) : undefined;
        try {
            const expectedAppId = options.boundAppId?.() ?? (typeof current.appId === 'string' ? current.appId : undefined);
            const { access, appId, revision } = readProfileAccessSnapshot(current.access, getProfileDir() ?? undefined, expectedAppId);
            sendJson(res, 200, { config: { ...safe, ...(memoryView === undefined ? {} : { memory: memoryView }), ...(appId ? { appId } : {}), access, accessRevision: revision } });
        }
        catch (error) {
            sendJson(res, 503, { error: error instanceof AccessConfigConflict ? error.message : '无法读取访问设置，请检查 profile 配置文件。' });
        }
        return;
    }
    let body;
    try {
        body = await readJsonBody(req, MAX_CONFIG_BODY_BYTES);
    }
    catch (err) {
        sendJson(res, 400, { ok: false, error: `invalid request body: ${err instanceof Error ? err.message : String(err)}` });
        return;
    }
    if (!isActive()) {
        sendJson(res, 503, { ok: false, error: 'QQ 插件已重载，请刷新后重试。' });
        return;
    }
    if (typeof body !== 'object' || body === null) {
        sendJson(res, 400, { ok: false, error: '请求体必须是 JSON 对象' });
        return;
    }
    const submitted = body;
    // 白名单与凭据/只读字段拦截
    for (const key of Object.keys(submitted)) {
        if (key !== 'accessRevision' && !EDITABLE_CONFIG_KEYS.has(key)) {
            const reason = key === 'appId' || key === 'appSecret'
                ? '凭据请使用绑定/更换/解绑功能'
                : key === 'cwd'
                    ? 'cwd 为只读字段'
                    : '不支持的字段';
            sendJson(res, 400, { ok: false, error: `${reason}: ${key}` });
            return;
        }
    }
    // 逐键 Schema 校验（非法值拒绝，返回首个错误）
    let validated = {};
    try {
        validated = Object.fromEntries(Object.entries(submitted).filter(([key]) => key !== 'accessRevision').map(([key, value]) => {
            const check = EDITABLE_CONFIG_SCHEMAS[key];
            if (check === undefined)
                throw new TypeError(`不支持的字段: ${key}`);
            return [key, check(value)];
        }));
    }
    catch (err) {
        sendJson(res, 400, { ok: false, error: err instanceof TypeError ? err.message : String(err) });
        return;
    }
    let persisted;
    try {
        const profileDir = getProfileDir() ?? undefined;
        const current = options.currentConfig?.() ?? {};
        const expectedAppId = options.boundAppId?.() ?? (typeof current.appId === 'string' ? current.appId : undefined);
        const { revision } = readProfileAccessSnapshot(current.access, profileDir, expectedAppId);
        if (validated.access !== undefined && submitted.accessRevision !== revision) {
            sendJson(res, 409, { ok: false, error: new AccessConfigConflict().message });
            return;
        }
        persisted = options.onUpdateConfig === undefined
            ? updateProfileConfig(validated, profileDir, undefined, validated.access === undefined ? undefined : { revision, fallback: current.access, appId: expectedAppId })
            : options.onUpdateConfig(validated);
    }
    catch (error) {
        sendJson(res, error instanceof AccessConfigConflict ? 409 : 500, { ok: false, error: error instanceof AccessConfigConflict ? error.message : '无法读取或保存配置，请检查 profile 配置文件。' });
        return;
    }
    if (!persisted) {
        sendJson(res, 500, { ok: false, error: '无法定位 profile 目录或写入失败' });
        return;
    }
    sendJson(res, 200, { ok: true, message: '配置已保存，插件将自动重载（进行中的机器人会话将重置）' });
}
/** 工作区目录：优先 config.cwd，否则官方默认 ~/.dsh-qqbot/workspace */
function workspaceDir(config) {
    const cwd = config.cwd;
    return typeof cwd === 'string' && cwd.trim() ? cwd : join(os.homedir(), '.dsh-qqbot', 'workspace');
}
const PERSONA_MAX_BYTES = 512 * 1024;
/** 人设：读写工作区 AGENTS.md（角色卡 + 行为规约） */
async function handlePersona(req, res, options, isActive) {
    if (!trusted(req)) {
        sendJson(res, 403, { error: 'forbidden' });
        return;
    }
    if (!isActive()) {
        sendJson(res, 503, { ok: false, error: 'QQ 插件已重载，请刷新后重试。' });
        return;
    }
    const file = join(workspaceDir(options.currentConfig?.() ?? {}), 'AGENTS.md');
    if (req.method === 'GET') {
        let content;
        try {
            if (statSync(file).size > PERSONA_MAX_BYTES) {
                sendJson(res, 413, { ok: false, error: '现有角色卡超过 512KB，请用本地编辑器打开。' });
                return;
            }
            content = readFileSync(file, 'utf8');
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                sendJson(res, 500, { ok: false, error: '无法读取现有角色卡。' });
                return;
            }
            content = DEFAULT_PERSONA;
        }
        sendJson(res, 200, { path: file, content });
        return;
    }
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' });
        return;
    }
    let body;
    try {
        // JSON escaping can expand each UTF-8 byte to up to six wire bytes.
        body = await readJsonBody(req, PERSONA_MAX_BYTES * 6 + 1024);
    }
    catch (err) {
        sendJson(res, 400, { ok: false, error: `invalid request body: ${err instanceof Error ? err.message : String(err)}` });
        return;
    }
    const content = body?.content;
    if (typeof content !== 'string') {
        sendJson(res, 400, { ok: false, error: 'content 必须是字符串' });
        return;
    }
    if (Buffer.byteLength(content, 'utf8') > PERSONA_MAX_BYTES) {
        sendJson(res, 413, { ok: false, error: '人设内容过大（上限 512KB）' });
        return;
    }
    try {
        mkdirSync(dirname(file), { recursive: true });
        const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
        writeFileSync(tmp, content, { mode: 0o600 });
        renameSync(tmp, file);
        sendJson(res, 200, { ok: true, path: file, message: '角色卡已写入工作区' });
    }
    catch (error) {
        sendJson(res, 500, { ok: false, error: `写入失败：${error instanceof Error ? error.message : String(error)}` });
    }
}
/** 可用 preset 列表（人设下拉） */
async function handlePresets(req, res, options, isActive) {
    if (!trusted(req)) {
        sendJson(res, 403, { error: 'forbidden' });
        return;
    }
    if (!isActive()) {
        sendJson(res, 503, { ok: false, error: 'QQ 插件已重载，请刷新后重试。' });
        return;
    }
    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'method not allowed' });
        return;
    }
    try {
        const presets = await options.listPresets?.() ?? [];
        sendJson(res, 200, { presets });
    }
    catch (error) {
        sendJson(res, 200, { presets: [], error: error instanceof Error ? error.message : String(error) });
    }
}
/** 记忆自动整理：POST 立即跑一次；GET 查看当前配置状态 */
async function handleOrganize(req, res, options, isActive) {
    if (!trusted(req)) {
        sendJson(res, 403, { error: 'forbidden' });
        return;
    }
    if (!isActive()) {
        sendJson(res, 503, { ok: false, error: 'QQ 插件已重载，请刷新后重试。' });
        return;
    }
    const memory = (options.currentConfig?.() ?? {}).memory;
    if (req.method === 'GET') {
        sendJson(res, 200, {
            enabled: Boolean(memory?.enabled && memory.backend !== 'none' && memory.organizeEnabled && typeof memory.vaultPath === 'string' && memory.vaultPath.trim()),
            command: typeof memory?.organizeCommand === 'string' ? memory.organizeCommand : '',
            times: typeof memory?.organizeTimes === 'string' ? memory.organizeTimes : '',
        });
        return;
    }
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' });
        return;
    }
    const result = runOrganizerNow(memory, console, (options.currentConfig?.() ?? {}));
    sendJson(res, result.ok ? 200 : 400, result);
}
/** Breeze 凭证保存：只改音色时不必重新粘贴 Key */
async function handleVoiceCredential(req, res, isActive) {
    if (!trusted(req)) {
        sendJson(res, 403, { error: 'forbidden' });
        return;
    }
    if (!isActive()) {
        sendJson(res, 503, { ok: false, error: 'QQ 插件已重载，请刷新后重试。' });
        return;
    }
    if (req.method === 'GET') {
        const current = readVoiceCredentials();
        sendJson(res, 200, { configured: current !== null, voiceId: current?.voiceId ?? '' });
        return;
    }
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' });
        return;
    }
    let body;
    try {
        body = await readJsonBody(req, 64 * 1024);
    }
    catch {
        sendJson(res, 400, { ok: false, error: 'invalid request body' });
        return;
    }
    const input = body;
    const voiceId = typeof input?.voiceId === 'string' ? input.voiceId.trim() : '';
    const typedKey = typeof input?.apiKey === 'string' ? input.apiKey.trim() : '';
    if (!voiceId || voiceId.length > 200) {
        sendJson(res, 400, { ok: false, error: '音色 ID 不能为空' });
        return;
    }
    const current = readVoiceCredentials();
    const apiKey = typedKey || current?.apiKey || '';
    if (!apiKey || apiKey.length > 500) {
        sendJson(res, 400, { ok: false, error: '没有可用的 API Key，请填一个再保存' });
        return;
    }
    const ok = saveVoiceCredentials({ apiKey, voiceId });
    sendJson(res, ok ? 200 : 500, ok ? { ok: true, message: '已保存（只改音色无需重贴 Key）' } : { ok: false, error: '凭证写入失败' });
}
/** 音色试听：合成一小段 wav 直接返回给浏览器播放 */
async function handleVoicePreview(req, res, isActive) {
    if (!trusted(req)) {
        sendJson(res, 403, { error: 'forbidden' });
        return;
    }
    if (!isActive()) {
        sendJson(res, 503, { error: 'QQ 插件已重载，请刷新后重试。' });
        return;
    }
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' });
        return;
    }
    let body;
    try {
        body = await readJsonBody(req, 16 * 1024);
    }
    catch {
        sendJson(res, 400, { ok: false, error: 'invalid request body' });
        return;
    }
    const input = body;
    const voiceId = typeof input?.voiceId === 'string' ? input.voiceId.trim() : '';
    const text = (typeof input?.text === 'string' ? input.text : '你好呀，今天也一起聊天吧。').slice(0, 60);
    if (!voiceId) {
        sendJson(res, 400, { ok: false, error: '缺少音色 ID' });
        return;
    }
    const credentials = readVoiceCredentials();
    if (credentials === null) {
        sendJson(res, 400, { ok: false, error: '还没有保存 Breeze 凭证' });
        return;
    }
    try {
        const wav = await synthesizeBreeze(text, {
            apiKey: credentials.apiKey,
            voiceId,
            maxChars: 80,
            timeoutMs: 20000,
        });
        const processed = processWav(wav, { fadeMs: 30, padMs: 300, sampleRate: 16000, channels: 1 });
        res.writeHead(200, { 'content-type': 'audio/wav', 'content-length': String(processed.length), 'cache-control': 'no-store' });
        res.end(processed);
    }
    catch (error) {
        sendJson(res, 500, { ok: false, error: `试听合成失败：${error instanceof Error ? error.message : String(error)}` });
    }
}
const SAMPLE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'voice-samples');
/** 内置情绪样音：按 voiceId 返回 mp3；没有样音则 404，由前端回落实时合成 */
function handleVoiceSample(req, res) {
    if (!trusted(req)) {
        sendJson(res, 403, { error: 'forbidden' });
        return;
    }
    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'method not allowed' });
        return;
    }
    const url = new URL(req.url ?? '/', 'http://localhost');
    const voiceId = (url.searchParams.get('voiceId') ?? '').trim();
    if (!/^[A-Za-z0-9_-]{4,120}$/.test(voiceId)) {
        sendJson(res, 400, { error: '音色 ID 不合法' });
        return;
    }
    const localFile = join(PLUGIN_HOME, 'voice-samples', `${voiceId}.mp3`);
    const hasLocalSample = existsSync(localFile);
    const file = hasLocalSample ? localFile : join(SAMPLE_DIR, `${voiceId}.mp3`);
    if (!existsSync(file)) {
        sendJson(res, 404, { error: '没有内置样音' });
        return;
    }
    const buffer = readFileSync(file);
    res.writeHead(200, { 'content-type': 'audio/mpeg', 'content-length': String(buffer.length), 'cache-control': hasLocalSample ? 'no-store' : 'public, max-age=86400' });
    res.end(buffer);
}
//# sourceMappingURL=bind-routes.js.map