/** Stand-in for pg.Pool: only what health checks and shutdown use. */
export class FakePgPool {
  up = true;

  async query(): Promise<{ rows: unknown[] }> {
    if (!this.up) throw new Error('database down');
    return { rows: [{ '?column?': 1 }] };
  }

  async end(): Promise<void> {}
}
