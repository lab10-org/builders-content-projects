import { assertPreconditions } from '../../lib/preflight'
import type { ActorProfile } from '../../lib/profiles'
import type { RunInput } from '../../lib/types'
import type { RunDeps } from '../deps'

/** What every later run-level step reads. */
export interface PreflightState extends RunInput {
  profile: ActorProfile
}

/**
 * The run's first step: verify the environment, then load the actor's profile.
 * A run-level step, so it is deliberately NOT wrapped in `withReelFailure` — a
 * `FatalRunError` must abort the run, not become a reel-shaped value (7.1, 7.2,
 * 4.5).
 */
export async function preflight(input: RunInput, deps: RunDeps): Promise<PreflightState> {
  // Preconditions first: nothing is read or fetched until the environment is
  // known to be usable.
  await assertPreconditions(deps.env, deps.probe)

  const profile = await deps.profiles.loadActorProfile(deps.profilesDir, input.actor)

  return { ...input, profile }
}
