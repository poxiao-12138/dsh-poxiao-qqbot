import { afterEach, expect, it, vi } from 'vitest';
import { extractTranscript, generateCandidates } from './organizer.ts';

afterEach(() => vi.unstubAllGlobals());

it('keeps source IDs and reports only selected fields from matched world receipts', () => {
  const lines = [
    { seq: 1, type: 'user/message', data: { id: 'qq-1', content: [{ type: 'text', text: '去清理院子' }] } },
    { seq: 2, type: 'tool/call', data: { callId: 'call-1', name: 'mcp__dafeiyu-world__yard_collect' } },
    { seq: 3, type: 'tool/result', data: { message: { toolCallId: 'other', content: [{ type: 'text', text: 'ignored' }] } } },
    { seq: 4, type: 'tool/result', data: { message: { toolCallId: 'call-1', content: [{ type: 'text', text: '{"status":"running","private":"ignored"}' }] } } },
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
