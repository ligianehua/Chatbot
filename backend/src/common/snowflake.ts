/**
 * Lexicographically sortable, time-ordered string ID for messages.
 * Format: 13-digit epoch ms + 4-digit per-ms counter = 17 chars numeric.
 * Single-node only; for multi-node deployment add a node-id prefix.
 *
 * Counter wraps at 10000 per ms (theoretical 10M msgs/sec ceiling, far beyond MVP).
 * On clock skew backwards we re-use lastMs to keep monotonic ordering.
 */
export class Snowflake {
  private static counter = 0;
  private static lastMs = 0;

  static generate(): string {
    let now = Date.now();
    if (now < Snowflake.lastMs) now = Snowflake.lastMs;
    if (now === Snowflake.lastMs) {
      Snowflake.counter = (Snowflake.counter + 1) % 10000;
    } else {
      Snowflake.counter = 0;
      Snowflake.lastMs = now;
    }
    return `${now}${String(Snowflake.counter).padStart(4, '0')}`;
  }
}
