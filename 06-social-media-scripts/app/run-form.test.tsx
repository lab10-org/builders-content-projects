// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TOP, RunForm } from './run-form'

// T1 leaves Vitest `globals` off, so RTL's automatic cleanup never registers.
afterEach(cleanup)

const fill = (account = 'morningbrew', actor = 'juanse', top = '3') => {
  fireEvent.change(screen.getByLabelText('Cuenta'), { target: { value: account } })
  fireEvent.change(screen.getByLabelText('Actor'), { target: { value: actor } })
  fireEvent.change(screen.getByLabelText('Reels'), { target: { value: top } })
}

describe('RunForm', () => {
  it('offers exactly the actors that have a profile, with no free-text input (5.2)', () => {
    render(<RunForm actors={['ana', 'juanse']} />)

    const options = screen.getAllByRole('option').map((o) => (o as HTMLOptionElement).value)
    // Equality, not containment: no hard-coded or typed-in actor can be chosen.
    expect(options).toEqual(['ana', 'juanse'])
    expect(screen.getByLabelText('Actor').tagName).toBe('SELECT')
  })

  it('starts the run with the entered values and shows the runId (5.1)', async () => {
    const startRun = vi.fn().mockResolvedValue('run_42')
    render(<RunForm actors={['ana', 'juanse']} startRun={startRun} />)

    fill()
    fireEvent.click(screen.getByRole('button', { name: /generar/i }))

    await waitFor(() => expect(startRun).toHaveBeenCalledTimes(1))
    expect(startRun).toHaveBeenCalledWith({ account: 'morningbrew', actor: 'juanse', top: 3 })
    await screen.findByText(/run_42/)
  })

  it('defaults the reel count to the same value the route defaults to', () => {
    render(<RunForm actors={['juanse']} />)

    expect((screen.getByLabelText('Reels') as HTMLInputElement).value).toBe(String(DEFAULT_TOP))
    expect(DEFAULT_TOP).toBe(3)
  })

  it('disables the submit control while the run is starting', async () => {
    let release!: (id: string) => void
    const startRun = vi.fn(() => new Promise<string>((resolve) => (release = resolve)))
    render(<RunForm actors={['juanse']} startRun={startRun} />)

    fill()
    const button = screen.getByRole('button') as HTMLButtonElement
    fireEvent.click(button)

    // One click cannot start two runs. Asserting the DOM property directly
    // rather than adding jest-dom just for one matcher.
    await waitFor(() => expect(button.disabled).toBe(true))

    release('run_1')
    await waitFor(() => expect(button.disabled).toBe(false))
  })

  it('shows the error and keeps the entered values when starting fails', async () => {
    const startRun = vi.fn().mockRejectedValue(new Error('Could not start the run (HTTP 400).'))
    render(<RunForm actors={['ana', 'juanse']} startRun={startRun} />)

    fill('morningbrew', 'juanse', '5')
    fireEvent.click(screen.getByRole('button'))

    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toMatch(/400/)
    expect((screen.getByLabelText('Cuenta') as HTMLInputElement).value).toBe('morningbrew')
    expect((screen.getByLabelText('Actor') as HTMLSelectElement).value).toBe('juanse')
    expect((screen.getByLabelText('Reels') as HTMLInputElement).value).toBe('5')
  })
})
