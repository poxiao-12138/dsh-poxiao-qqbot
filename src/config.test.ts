import { describe, it, expect } from 'vitest';
import { ConfigSchema } from './config.ts';

describe('ConfigSchema 默认值（内层外层默认必须对齐：#94-1 不变量）', () => {
  it.each([{}, { access: {} }, { access: null }])('未设置权限时使用空白名单 %j', input => {
    expect(ConfigSchema(input).access).toMatchObject({
      c2cMode: 'allowlist', c2cAllow: [],
      groupMode: 'allowlist', groupAllow: [],
      commandMode: 'allowlist',
    });
  });

  it.each(['open', 'allowlist', 'disabled'] as const)('保留显式设置 %s', mode => {
    const access = { c2cMode: mode, groupMode: mode, commandMode: mode };
    expect(ConfigSchema({ access }).access).toMatchObject(access);
  });

  it('闲置会话默认 30 分钟回收', () => {
    const cfg = ConfigSchema({});
    expect(cfg.sessionIdleTimeout).toBe(30 * 60 * 1000);
  });

  it.each([
    [{}, 'c2c'],
    [{ proactiveDelivery: {} }, 'c2c'],
    [{ proactiveDelivery: null }, 'c2c'],
    [{ proactiveDelivery: { externalTurns: 'off' } }, 'off'],
    [{ proactiveDelivery: { externalTurns: 'all' } }, 'all'],
  ])('proactiveDelivery.externalTurns：%j → %s', (input, expected) => {
    expect(ConfigSchema(input).proactiveDelivery.externalTurns).toBe(expected);
  });
});

it('默认合并 8 秒并保留显式关闭', () => {
  expect(ConfigSchema({}).wakeBatchSeconds).toBe(8);
  expect(ConfigSchema({ wakeBatchSeconds: 0 }).wakeBatchSeconds).toBe(0);
});
