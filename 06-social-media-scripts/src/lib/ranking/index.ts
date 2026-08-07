/**
 * Selects the highest-viewed reels and stamps a rank starting at 1.
 *
 * Pure: no I/O, no mutation of the input. Reels tied on `views` keep the order
 * they arrived in — the adapter yields them most-recent-first, and `Array#sort`
 * is stable as of ES2019, which is what makes that tie-break deterministic
 * (1.3) rather than engine-dependent.
 */
export function rankReels<T extends { views: number }>(
  reels: readonly T[],
  top: number,
): Array<T & { rank: number }> {
  return [...reels]
    .sort((a, b) => b.views - a.views)
    .slice(0, Math.max(0, top))
    .map((reel, index) => ({ ...reel, rank: index + 1 }))
}
