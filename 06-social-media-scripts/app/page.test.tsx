// @vitest-environment jsdom
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const listActors = vi.fn()
vi.mock('../src/lib/profiles', () => ({ listActors: (dir: string) => listActors(dir) }))

const { default: Page } = await import('./page')

afterEach(cleanup)

describe('the page', () => {
  it('offers exactly the actors that have a profile (5.2)', async () => {
    listActors.mockResolvedValue(['ana', 'juanse'])

    // RTL cannot render an async server component; awaiting it yields a plain
    // element tree.
    render(await Page())

    expect(screen.getAllByRole('option').map((o) => (o as HTMLOptionElement).value)).toEqual([
      'ana',
      'juanse',
    ])
  })

  it("reads the repo's profiles directory resolved from cwd", async () => {
    listActors.mockResolvedValue(['juanse'])

    render(await Page())

    expect(listActors).toHaveBeenCalledWith(join(process.cwd(), 'profiles'))
  })
})
