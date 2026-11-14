import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'js-yaml';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Context } from '@deepseek-ai/cordis';
import { WORLD_CREDENTIAL_REF, worldEndpoint } from './connection.ts';

function connection(): { endpoint: URL; token: string } | undefined {
  try {
    const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
    const file = path.join(home, '.credentials.yaml');
    if (process.platform !== 'win32' && (fs.statSync(file).mode & 0o077)) return;
    const document = YAML.load(fs.readFileSync(file, 'utf8')) as { refs?: Record<string, string> } | undefined;
    const saved = JSON.parse(document?.refs?.[WORLD_CREDENTIAL_REF] ?? '{}');
    if (saved.enabled !== true || typeof saved.token !== 'string' || !saved.token.trim() || /\s/.test(saved.token)) return;
    return { endpoint: worldEndpoint(saved.endpoint), token: saved.token };
  } catch {
    return undefined;
  }
}

function transportFor(saved: NonNullable<ReturnType<typeof connection>>) {
  return new StreamableHTTPClientTransport(saved.endpoint, {
    requestInit: { headers: { Authorization: 'Bearer ' + saved.token }, redirect: 'error' },
    fetch: (url, init) => fetch(url, { ...init, redirect: 'error',
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }),
  });
}

export function worldPrompt(): string {
  if (!connection()) return '';
  return '\n\n【小世界】使用当前会话提供的小世界工具。先查询实际场景与目标，再按用户请求操作。只根据工具回执报告结果。';
}

export function installWorldTools(ctx: Context) {
  const registry = ctx.get('tools') as { register(spec: Record<string, unknown>): unknown } | undefined;
  const registrations = new Map<string, { signature: string; dispose: () => void }>();
  let pending: Promise<void> | undefined;
  let closed = false;

  function clear(): void {
    for (const { dispose } of registrations.values()) dispose();
    registrations.clear();
  }

  async function discover(): Promise<void> {
    if (!registry || closed) return;
    const saved = connection();
    if (!saved) { clear(); return; }
    const client = new Client({ name: 'qqbot-small-world', version: '1.0.0' });
    try {
      await client.connect(transportFor(saved), { timeout: 5000 });
      const available = new Map<string, Awaited<ReturnType<Client['listTools']>>['tools'][number]>();
      let cursor: string | undefined;
      const seen = new Set<string>();
      do {
        const page = await client.listTools(cursor ? { cursor } : undefined, { timeout: 5000 });
        for (const tool of page.tools) available.set(tool.name, tool);
        cursor = page.nextCursor;
        if (cursor && seen.has(cursor)) throw new Error('Repeated MCP tools cursor');
        if (cursor) seen.add(cursor);
      } while (cursor);
      if (closed) return;
      const current = connection();
      if (current?.endpoint.href !== saved.endpoint.href || current.token !== saved.token) { clear(); return; }
      for (const [name, entry] of registrations) {
        const tool = available.get(name);
        if (!tool || entry.signature !== JSON.stringify(tool)) {
          entry.dispose();
          registrations.delete(name);
        }
      }
      for (const [name, tool] of available) {
        if (registrations.has(name)) continue;
        const dispose = registry.register({
          name: 'mcp__dafeiyu-world__' + name,
          description: tool.description ?? name,
          parameters: tool.inputSchema,
          output: { schema: { type: 'string' },
            render: (_args: unknown, value: string) => [{ type: 'text', text: value }] },
          async execute(args: Record<string, unknown>) {
            return JSON.stringify(await callWorldTool(name, args));
          },
        });
        if (typeof dispose === 'function') registrations.set(name, { signature: JSON.stringify(tool), dispose: dispose as () => void });
      }
    } catch {
      clear();
    } finally {
      await client.close().catch(() => {});
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

async function callWorldTool(name: string, args: Record<string, unknown>) {
  const saved = connection();
  if (!saved) return { ok: false, message: '小世界未连接。' };
  const client = new Client({ name: 'qqbot-small-world', version: '1.0.0' });
  try {
    await client.connect(transportFor(saved), { timeout: 5000 });
    const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 60000 });
    if (result.isError) return { ok: false, content: result.content, structuredContent: result.structuredContent };
    return result.structuredContent ?? { content: result.content };
  } catch {
    return { ok: false, message: '小世界连接失败或操作结果未确认。' };
  } finally {
    await client.close().catch(() => {});
  }
}
