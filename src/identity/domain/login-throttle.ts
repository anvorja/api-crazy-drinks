/** At most `maxFailures` failed logins per `windowMs` for a key (an account or an IP). */
export interface ThrottleRule {
  maxFailures: number;
  windowMs: number;
}

/**
 * How long the key stays locked, in ms (0 = not locked). The lock lifts when enough
 * failures fall out of the sliding window.
 */
export function lockRemainingMs(
  failures: Date[],
  rule: ThrottleRule,
  now: Date,
): number {
  const recent = failures
    .map((f) => f.getTime())
    .filter((t) => now.getTime() - t < rule.windowMs)
    .sort((a, b) => a - b);
  if (recent.length < rule.maxFailures) return 0;
  return (
    recent[recent.length - rule.maxFailures] + rule.windowMs - now.getTime()
  );
}

export interface LoginFailureRepository {
  since(key: string, since: Date): Promise<Date[]>;
  /** Records a failure and forgets this key's failures older than `forgetBefore`. */
  record(key: string, at: Date, forgetBefore: Date): Promise<void>;
  clear(key: string): Promise<void>;
}
