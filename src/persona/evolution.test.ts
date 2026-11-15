import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ImQQBotConfig } from '../config.ts';
import type { Logger } from '../types.ts';
import { evolutionPrompt, isExplicitEvolutionRequest, PersonaEvolution } from './evolution.ts';

const paths = vi.hoisted(() => ({ home: '' }));
vi.mock('../shared/dirs.ts', () => ({
  get PLUGIN_HOME() { return paths.home; },
  resolveAgentCwd: () => paths.home,
}));
vi.mock('../voice/credentials.ts', () => ({ readDeepSeekKey: () => 'test-key' }));

const logger = { info: vi.fn(), warn: vi.fn() } as unknown as Logger;
let evolution: PersonaEvolution | undefined;
let update: ReturnType<typeof vi.fn>;
let config: ImQQBotConfig;
let cardPath: string;
const baseCard = '# 大肥鱼\n\n你有自己的小脾气。\n';

beforeEach(() => {
  paths.home = fs.mkdtempSync(path.join(os.tmpdir(), 'qqbot-evolution-'));
  cardPath = path.join(paths.home, 'AGENTS.md');
  fs.writeFileSync(cardPath, baseCard);
  vi.clearAllMocks();
  config = {
    appId: 'test', memory: {
      enabled: true, backend: 'obsidian', vaultPath: paths.home,
      scope: '', idleMinutes: 30, organizeTimes: '04:10,13:10',
    },
  } as ImQQBotConfig;
  vi.useFakeTimers();
  update = vi.fn().mockImplementation(() => Promise.resolve(Response.json({
    choices: [{ message: { content: '{"index":0,"rule":"平时用更短的句子，先说重点。"}' } }],
  })));
  vi.stubGlobal('fetch', update);
});

afterEach(() => {
  evolution?.stop();
  evolution = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fs.rmSync(paths.home, { recursive: true, force: true });
});

it('applies an explicit owner adjustment once the chat is idle and uses only verified matching memories', async () => {
  fs.writeFileSync(path.join(paths.home, 'verified.md'), '---\nreview: verified\nscope: private:owner\n---\n# 说话方式\n说话方式偏好是短句。');
  fs.writeFileSync(path.join(paths.home, 'pending.md'), '---\nreview: pending\n---\n# 说话方式\n未经核实的内容。');
  fs.writeFileSync(path.join(paths.home, 'group.md'), '---\nreview: verified\nscope: group:elsewhere\n---\n# 说话方式\n群聊专用内容。');
  let idle = false;
  evolution = new PersonaEvolution(config, logger, (peer) => peer === 'owner', () => idle);
  evolution.add('guest', '请把说话方式改得简短些');
  evolution.add('owner', '请把说话方式改得简短些');
  await vi.advanceTimersByTimeAsync(10_000);
  expect(update).not.toHaveBeenCalled();
  idle = true;
  await vi.advanceTimersByTimeAsync(5_000);
  expect(update).toHaveBeenCalledTimes(1);
  const body = JSON.parse(update.mock.calls[0]![1].body);
  expect(JSON.parse(body.messages[1].content).notes).toEqual([expect.stringContaining('说话方式偏好是短句。')]);
  expect(fs.readFileSync(cardPath, 'utf8')).toMatch(/^# 大肥鱼\n\n你有自己的小脾气。\n/);
  expect(evolutionPrompt(config)).toContain('更短的句子');
  expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('outcome=applied file=AGENTS.md {"before":"","after":"平时用更短的句子，先说重点。"}'));
  await vi.advanceTimersByTimeAsync(30 * 60_000);
  expect(update).toHaveBeenCalledTimes(1);
});

it('uses the configured idle window for ordinary chat and rejects invalid model output', async () => {
  update.mockImplementation(() => Promise.resolve(Response.json({
    choices: [{ message: { content: '{"index":4,"rule":"这个下标无效"}' } }],
  })));
  evolution = new PersonaEvolution(config, logger, () => true, () => true);
  evolution.add('owner', '刚到家，今天有点热');
  await vi.advanceTimersByTimeAsync(29 * 60_000);
  expect(update).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(update).toHaveBeenCalledTimes(1);
  expect(fs.readFileSync(cardPath, 'utf8')).toBe(baseCard);
  expect(fs.readFileSync(path.join(paths.home, 'persona-evolution.log'), 'utf8')).toContain('event=started trigger=idle');
});

it('does not cap successful explicit attempts per day', async () => {
  evolution = new PersonaEvolution(config, logger, () => true, () => true);
  for (let index = 0; index < 5; index++) {
    evolution.add('owner', '请把说话方式改得简短些');
    await vi.advanceTimersByTimeAsync(5000);
  }
  expect(update).toHaveBeenCalledTimes(5);
});


it('preserves an external role card edit while a proposed evolution is pending', async () => {
  update.mockImplementationOnce(async () => {
    fs.appendFileSync(cardPath, '用户刚补上的角色设定。\n');
    return Response.json({ choices: [{ message: { content: '{"index":0,"rule":"平时说短一些。"}' } }] });
  });
  evolution = new PersonaEvolution(config, logger, () => true, () => true);
  evolution.add('owner', '把先说重点这条写进 AGENTS.md');
  await vi.advanceTimersByTimeAsync(5000);
  expect(update).toHaveBeenCalledOnce();
  expect(fs.readFileSync(cardPath, 'utf8')).toBe(baseCard + '用户刚补上的角色设定。\n');
  expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('reason=role_card_changed'));
});


it('recognizes a naturally phrased lasting chat habit without treating ordinary reminders as edits', async () => {
  const request = '小鲸鱼，以后我逗你的时候，你先跟我闹两句嘛，别急着一本正经地解释。记成你以后跟我聊天的习惯哈。';
  expect(isExplicitEvolutionRequest('记住我下次要买牛奶')).toBe(false);
  expect(isExplicitEvolutionRequest('今天就跟我闹两句嘛')).toBe(false);
  fs.writeFileSync(path.join(paths.home, 'verified.md'), '---\nreview: verified\nscope: private:owner\n---\n# 跟我聊天的习惯\n先接住玩笑。');
  evolution = new PersonaEvolution(config, logger, (peer) => peer === 'owner', () => true);
  evolution.add('owner', request);
  await vi.advanceTimersByTimeAsync(5000);
  expect(update).toHaveBeenCalledOnce();
  const log = fs.readFileSync(path.join(paths.home, 'persona-evolution.log'), 'utf8');
  const run = /run=([\w-]+) event=started trigger=explicit/.exec(log)?.[1];
  expect(run).toBeDefined();
  expect(log).toContain(`run=${run} event=memory status=searched notes=1`);
  expect(log).toContain(`run=${run} outcome=applied file=AGENTS.md {"before":"","after":"平时用更短的句子，先说重点。"}`);
  expect(log).not.toContain(request);
  expect(fs.readFileSync(cardPath, 'utf8')).toContain('- 平时用更短的句子，先说重点。');
});
