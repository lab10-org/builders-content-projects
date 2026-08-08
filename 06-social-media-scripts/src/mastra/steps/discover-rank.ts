import type { DiscoveredReel } from '../../lib/instagram'
import { rankReels } from '../../lib/ranking'
import type { ReelInput } from '../../lib/types'
import type { RunDeps } from '../deps'
import type { PreflightState } from './preflight'

export interface DiscoveredState extends PreflightState {
  reels: DiscoveredReel[]
}

export interface RankedState extends DiscoveredState {
  ranked: ReelInput[]
}

/**
 * Pulls the account's scan-window reels. A run-level step: a `FatalRunError`
 * from the client (an empty or unreachable account) aborts the run rather than
 * becoming a reel failure (1.1, 1.5).
 */
export async function discover(state: PreflightState, deps: RunDeps): Promise<DiscoveredState> {
  // The client's order is most-recent-first and is preserved verbatim — the
  // stable tie-break in 1.3 depends on it.
  const reels = await deps.instagram.discoverReels(state.account, state.scan)

  return { ...state, reels }
}

/** Pure: selects the top reels and shapes them for the per-reel workflow. */
export async function rank(state: DiscoveredState, _deps: RunDeps): Promise<RankedState> {
  const ranked = rankReels(state.reels, state.top).map(
    ({ rank: position, shortcode, mediaId, thumbnailUrl, views, likes, comments }) => ({
      rank: position,
      shortcode,
      mediaId,
      thumbnailUrl,
      metrics: { views, likes, comments },
    }),
  )

  return { ...state, ranked }
}
