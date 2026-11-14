import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'js-yaml';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { WORLD_CREDENTIAL_REF, worldEndpoint } from "./connection.js";
function connection() {
    try {
        const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
        const file = path.join(home, '.credentials.yaml');
        if (process.platform !== 'win32' && (fs.statSync(file).mode & 0o077))
            return;
        const document = YAML.load(fs.readFileSync(file, 'utf8'));
        const saved = JSON.parse(document?.refs?.[WORLD_CREDENTIAL_REF] ?? '{}');
        if (saved.enabled !== true || typeof saved.token !== 'string' || !saved.token.trim() || /\s/.test(saved.token))
            return;
        return { endpoint: worldEndpoint(saved.endpoint), token: saved.token };
    }
    catch {
        return undefined;
    }
}
function transportFor(saved) {
    return new StreamableHTTPClientTransport(saved.endpoint, {
        requestInit: { headers: { Authorization: 'Bearer ' + saved.token }, redirect: 'error' },
        fetch: (url, init) => fetch(url, { ...init, redirect: 'error',
            signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }),
    });
}
export function worldPrompt() {
    if (!connection())
        return '';
    return '\n\n【小世界】使用当前会话提供的小世界工具。先查询实际场景与目标，再按用户请求操作。只根据工具回执报告结果。';
}
export function installWorldTools(ctx) {
    const registry = ctx.get('tools');
    const registrations = new Map();
    let pending;
    let closed = false;
    function clear() {
        for (const { dispose } of registrations.values())
            dispose();
        registrations.clear();
    }
    async function discover() {
        if (!registry || closed)
            return;
        const saved = connection();
        if (!saved) {
            clear();
            return;
        }
        const client = new Client({ name: 'qqbot-small-world', version: '1.0.0' });
        try {
            await client.connect(transportFor(saved), { timeout: 5000 });
            const available = new Map();
            let cursor;
            const seen = new Set();
            do {
                const page = await client.listTools(cursor ? { cursor } : undefined, { timeout: 5000 });
                for (const tool of page.tools)
                    available.set(tool.name, tool);
                cursor = page.nextCursor;
                if (cursor && seen.has(cursor))
                    throw new Error('Repeated MCP tools cursor');
                if (cursor)
                    seen.add(cursor);
            } while (cursor);
            if (closed)
                return;
            const current = connection();
            if (current?.endpoint.href !== saved.endpoint.href || current.token !== saved.token) {
                clear();
                return;
            }
            for (const [name, entry] of registrations) {
                const tool = available.get(name);
                if (!tool || entry.signature !== JSON.stringify(tool)) {
                    entry.dispose();
                    registrations.delete(name);
                }
            }
            for (const [name, tool] of available) {
                if (registrations.has(name))
                    continue;
                const dispose = registry.register({
                    name: 'mcp__dafeiyu-world__' + name,
                    description: tool.description ?? name,
                    parameters: tool.inputSchema,
                    output: { schema: { type: 'string' },
                        render: (_args, value) => [{ type: 'text', text: value }] },
                    async execute(args) {
                        return JSON.stringify(await callWorldTool(name, args));
                    },
                });
                if (typeof dispose === 'function')
                    registrations.set(name, { signature: JSON.stringify(tool), dispose: dispose });
            }
        }
        catch {
            clear();
        }
        finally {
            await client.close().catch(() => { });
        }
    }
    return {
        refresh() {
            return pending ??= discover().finally(() => { pending = undefined; });
        },
        dispose() {
            closed = true;
            clear();
        },
    };
}
async function callWorldTool(name, args) {
    const saved = connection();
    if (!saved)
        return { ok: false, message: '小世界未连接。' };
    const client = new Client({ name: 'qqbot-small-world', version: '1.0.0' });
    try {
        await client.connect(transportFor(saved), { timeout: 5000 });
        const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 60000 });
        if (result.isError)
            return { ok: false, content: result.content, structuredContent: result.structuredContent };
        return result.structuredContent ?? { content: result.content };
    }
    catch {
        return { ok: false, message: '小世界连接失败或操作结果未确认。' };
    }
    finally {
        await client.close().catch(() => { });
    }
}
//# sourceMappingURL=tools.js.map