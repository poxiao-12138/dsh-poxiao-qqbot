import { afterEach, expect, it, vi } from 'vitest';
import { ProactiveWake, proactiveProbability, proactiveText } from './proactive-wake.ts';

afterEach(() => vi.useRealTimers());

it('checks after 30–90 minutes and cancels on shutdown', async () => {
  vi.useFakeTimers();
  const check = vi.fn();
  const wake = new ProactiveWake(check, () => 0);
  wake.watch('owner');
  wake.watch('owner');
  await vi.advanceTimersByTimeAsync(29 * 60_000);
  expect(check).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(check).toHaveBeenCalledExactlyOnceWith('owner', expect.any(Number));
  wake.stop();
  await vi.advanceTimersByTimeAsync(90 * 60_000);
  expect(check).toHaveBeenCalledTimes(1);
});

it('uses the old idle threshold, rate, and night adjustment', () => {
  expect(proactiveProbability(14 * 60_000, 12)).toBe(0);
  expect(proactiveProbability(15 * 60_000, 12)).toBe(0.3);
  expect(proactiveProbability(15 * 60_000, 23)).toBe(0.09);
});

it('requires an explicit decision with an actual message before sending', () => {
  expect(proactiveText('[[静默]]')).toBeUndefined();
  expect(proactiveText('我没有特别想说的话。')).toBeUndefined();
  expect(proactiveText('[[主动联系]]\n我刚想起你说的那个梗。')).toBe('我刚想起你说的那个梗。');
});
