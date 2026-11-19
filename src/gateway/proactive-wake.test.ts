import { afterEach, expect, it, vi } from 'vitest';
import { ProactiveWake, proactiveText } from './proactive-wake.ts';

afterEach(() => vi.useRealTimers());

it.each([[0, 120], [0.999999, 240]])('checks on the 2–4 hour cadence (%s) and cancels on shutdown', async (random, minutes) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 18, 9));
  const check = vi.fn();
  const wake = new ProactiveWake(check, () => random);
  wake.watch('owner');
  wake.watch('owner');
  await vi.advanceTimersByTimeAsync(minutes * 60_000 - 1000);
  expect(check).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1000);
  expect(check).toHaveBeenCalledExactlyOnceWith('owner', expect.any(Number));
  wake.stop();
  await vi.advanceTimersByTimeAsync(4 * 60 * 60_000);
  expect(check).toHaveBeenCalledTimes(1);
});

it('defers a wake that falls after midnight until 08:00', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 18, 23));
  const check = vi.fn();
  const wake = new ProactiveWake(check, () => 0);
  wake.watch('owner');
  await vi.advanceTimersByTimeAsync(9 * 60 * 60_000 - 1);
  expect(check).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(check).toHaveBeenCalledTimes(1);
  wake.stop();
});

it('uses plain text and converts the old silence marker to a greeting', () => {
  expect(proactiveText('[[静默]]')).toBe('来跟你打个招呼。');
  expect(proactiveText('你今天忙得怎么样？')).toBe('你今天忙得怎么样？');
  expect(proactiveText('[[主动联系]]\n我想起了那个梗。')).toBe('我想起了那个梗。');
});
