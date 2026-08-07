import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { FatalRunError } from '../preflight'

export interface ActorProfile {
  name: string
  /** Raw markdown, unparsed — handed to the script prompt as-is (4.2). */
  markdown: string
}

const EXTENSION = '.md'

/** A bare file name: no separators, no traversal, no dot-entries. */
const isBareName = (name: string): boolean =>
  name.length > 0 && !/[\\/]/.test(name) && name !== '.' && name !== '..'

/**
 * Exactly the actors that have a profile (5.2). Resolves `[]` rather than
 * throwing when the directory is missing, so the page still renders before any
 * profile has been written.
 */
export async function listActors(dir: string): Promise<string[]> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }

  return entries
    .filter((entry) => entry.endsWith(EXTENSION))
    .map((entry) => entry.slice(0, -EXTENSION.length))
    .sort()
}

export async function loadActorProfile(dir: string, name: string): Promise<ActorProfile> {
  const unknown = () =>
    new FatalRunError(
      'unknown-actor',
      `No profile for actor "${name}". Add profiles/${name}.md, or pick an actor that has one.`,
    )

  // Validate before touching the filesystem, so a crafted name can never read
  // outside `dir`.
  if (!isBareName(name)) throw unknown()

  try {
    return { name, markdown: await readFile(join(dir, `${name}${EXTENSION}`), 'utf8') }
  } catch {
    throw unknown()
  }
}
