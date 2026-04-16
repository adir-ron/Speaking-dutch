/**
 * Beta-prior smoothed success rate.
 * Avoids the 1/1 = 100% mastery bug.
 *
 * smoothedRate(1, 1) ≈ 0.6  (not 1.0)
 * smoothedRate(5, 5) ≈ 0.78
 * smoothedRate(0, 5) ≈ 0.22
 * smoothedRate(0, 0) = 0.5  (prior)
 */
export function smoothedRate(successes: number, attempts: number): number {
  return (successes + 2) / (attempts + 4);
}

/**
 * Update confidence using weighted moving average.
 * Only call when attempts > 0 (critical regression guard).
 */
export function updateConfidence(
  oldConfidence: number,
  successes: number,
  attempts: number,
): number {
  if (attempts <= 0) return oldConfidence;
  const rate = smoothedRate(successes, attempts);
  return 0.6 * oldConfidence + 0.4 * rate;
}
