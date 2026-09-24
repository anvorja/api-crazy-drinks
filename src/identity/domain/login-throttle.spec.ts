import { lockRemainingMs } from './login-throttle.js';

const rule = { maxFailures: 3, windowMs: 60_000 };
const at = (s: number) => new Date(s * 1000);

describe('lockRemainingMs', () => {
  it('does not lock below the limit', () => {
    expect(lockRemainingMs([at(0), at(10)], rule, at(20))).toBe(0);
  });

  it('locks until enough failures leave the window', () => {
    // Oldest of the last 3 failures was at 10s: unlocked at 70s.
    expect(lockRemainingMs([at(10), at(20), at(30)], rule, at(40))).toBe(
      30_000,
    );
  });

  it('ignores failures outside the window', () => {
    expect(lockRemainingMs([at(0), at(70), at(80)], rule, at(90))).toBe(0);
  });
});
