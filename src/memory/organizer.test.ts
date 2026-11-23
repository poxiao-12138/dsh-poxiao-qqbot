import { afterEach, expect, it, vi } from 'vitest';
import { extractTranscript, generateCandidates, scanPrivateTranscript } from './organizer.ts';

afterEach(() => vi.unstubAllGlobals());

it('keeps source IDs and reports only selected fields from matched world receipts', () => {
  const lines = [
    { seq: 0, type: 'turn/start' },
    { seq: 1, type: 'user/message', data: { id: 'qq-1', source: { kind: 'user' }, content: [{ type: 'text', text: '去清理院子' }] } },
    { seq: 2, type: 'tool/call', data: { callId: 'call-1', name: 'mcp__dafeiyu-world__yard_collect' } },
    { seq: 3, type: 'tool/result', data: { message: { toolCallId: 'other', content: [{ type: 'text', text: 'ignored' }] } } },
    { seq: 4, type: 'tool/result', data: { message: { toolCallId: 'call-1', content: [{ type: 'text', text: '{"status":"running","private":"ignored"}' }] } } },
    { seq: 5, type: 'turn/end' },
  ];
  expect(extractTranscript(lines.map((line) => JSON.stringify(line)))).toEqual([
    { seq: 1, messageId: 'qq-1', role: '对方', text: '去清理院子' },
    { seq: 4, role: '小世界回执', text: 'yard_collect {"status":"running"}' },
  ]);
});

it('distinguishes no candidates from transport errors and invented sources', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const run = () => generateCandidates([{ seq: 7, role: '对方', text: '晚安' }], '整理规则', [], 'test-key');
  fetch.mockResolvedValueOnce(new Response('', { status: 503 }));
  await expect(run()).rejects.toThrow('HTTP 503');
  const result = (content: string) => Response.json({ choices: [{ message: { content } }] });
  fetch.mockResolvedValueOnce(result('{"candidates":[{"title":"测试","body":"正文","type":"共同经历","sourceSeqs":[8]}]}'));
  await expect(run()).rejects.toThrow('原文事件编号');
  fetch.mockResolvedValueOnce(result('{"candidates":[]}'));
  await expect(run()).resolves.toEqual([]);
});

it('keeps only complete QQ turns and excludes RPC inputs, system snapshots and their unrelated replies', () => {
  const input = (seq: number, kind: string, text: string, rpcId?: string) => ({
    seq, type: 'user/message', data: { source: { kind, rpcId }, content: [{ type: 'text', text }] },
  });
  const reply = (seq: number, text: string) => ({
    seq, type: 'assistant/message', data: { content: [{ type: 'text', text }] },
  });
  const marker = (seq: number, phase: string) => ({ seq, type: 'turn/' + phase });
  const lines = [
    marker(1, 'start'), input(2, 'user', 'QQ 原话'), input(3, 'agent-instructions', '系统提示'),
    reply(4, 'QQ 回复'), marker(5, 'end'),
    marker(6, 'start'), input(7, 'user', '通话原话和角色卡', 'dafec411-123'), reply(8, '通话草稿'), marker(9, 'end'),
    marker(10, 'start'), input(11, 'user', '混合回合 QQ'), input(12, 'user', '桌面原话', 'rpc-1'), reply(13, '混合回复'), marker(14, 'end'),
    marker(15, 'start'), input(16, 'user', '还没结束'), reply(17, '草稿'),
  ].map(line => JSON.stringify(line));
  expect(scanPrivateTranscript(lines).transcript.map(row => row.seq)).toEqual([2, 4]);
  expect(scanPrivateTranscript(lines, 5)).toEqual({ transcript: [], through: 14 });
});

it('rejects truncated model output instead of accepting an incomplete review', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ choices: [{ finish_reason: 'length', message: { content: '{"candidates":[]}' } }] })));
  await expect(generateCandidates([{ seq: 1, role: '对方', text: '原话' }], '', [], 'key')).rejects.toThrow('截断');
});

it('adds an existing participant page when the summary explicitly names that person', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify({ candidates: [{ title: '约定', body: '爸爸说以后要先问他。', type: '约定', sourceSeqs: [1], links: [] }] }) } }] })));
  const rows = await generateCandidates([{ seq: 1, role: '对方', text: '以后先问我' }], '', ['爸爸'], 'key', ['爸爸']);
  expect(rows[0].links).toContain('爸爸');
});
