export interface ImageModerationResult {
  allowed: boolean;
  /** Matched category labels, e.g. ['sexual', 'violence', 'self-harm']. */
  categories: string[];
  reason?: string;
  /** Provider-specific scores, useful for tuning thresholds later. */
  scores?: Record<string, number>;
}

export interface ImageModerationProvider {
  readonly name: string;
  moderate(input: {
    buffer: Buffer;
    mime: string;
    filename?: string;
  }): Promise<ImageModerationResult>;
}
