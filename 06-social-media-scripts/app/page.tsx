import { join } from 'node:path'
import { listActors } from '../src/lib/profiles'
import { RunPanel } from './run-panel'

// A newly added profile must appear without a rebuild; otherwise `next build`
// would prerender the actor list once.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const actors = await listActors(join(process.cwd(), 'profiles'))

  return (
    <main>
      <h1>Lab10 — Scripts para reels</h1>
      <RunPanel actors={actors} />
    </main>
  )
}
