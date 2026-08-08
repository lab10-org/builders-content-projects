import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * E2E suite for `docs/specs/2026-08-06-reel-script-generation/`.
 * Implements the three cases of `e2e-tests-plan.md`, in the plan's order.
 *
 * Both API routes are intercepted in every case, exactly as the plan mandates:
 * a real run calls Instagram and OpenRouter, takes minutes and costs money.
 * The page's job is to start a run and render what the poll returns, so the
 * `page.route()` boundary is where the browser-visible behaviour actually lives.
 *
 * `baseURL` (port 3001) comes from `playwright.config.ts`; no origin is spelled
 * out here.
 */

// ---- fixtures -----------------------------------------------------------
// Shapes match `RunView` in `src/lib/types.ts`, which is what the real
// `GET /api/runs/<id>` returns.

const ANALYSIS = {
  objective: 'Reformular un dato conocido',
  highlights: ['Abre con una contradicción', 'Nombra un número duro'],
  targetAudience: 'Fundadores curiosos',
}

const METRICS_1 = { views: 6900000, likes: 412000, comments: 1820 }
const METRICS_2 = { views: 1200000, likes: 88000, comments: 430 }
const METRICS_3 = { views: 44000, likes: 3100, comments: 12 }

const okReel = (
  rank: number,
  shortcode: string,
  metrics: typeof METRICS_1,
  hook: string,
  body: string,
  closing: string,
) => ({
  rank,
  shortcode,
  thumbnailUrl: '',
  metrics,
  status: 'ok' as const,
  analysis: ANALYSIS,
  script: { hook, body, closing },
})

// ---- helpers ------------------------------------------------------------

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/** `POST /api/runs` — the collection endpoint, never the per-run one. */
const POST_RUNS = /\/api\/runs$/

/**
 * The page is server-rendered and hydrated afterwards. Clicking "Generar"
 * before React has attached the form's `onSubmit` fires a *native* GET submit:
 * the browser navigates to `/?account=…&actor=…&top=3`, no run ever starts and
 * the failure looks nothing like its cause. Observed while grounding this
 * suite against the dev server.
 *
 * React stamps `__reactProps$<id>` on every DOM node it owns handlers for, so
 * its presence on the `<form>` is the precise "the submit handler is live"
 * signal. There is no user-facing marker for hydration to wait on instead.
 */
async function waitForHydratedForm(page: Page) {
  await page.waitForFunction(() => {
    const form = document.querySelector('form')
    return !!form && Object.keys(form).some((key) => key.startsWith('__reactProps$'))
  })
}

/** Fills the form the way an operator would and submits it. */
async function startRun(page: Page, account: string) {
  await waitForHydratedForm(page)

  const accountField = page.getByLabel('Cuenta')
  await accountField.fill(account)
  // Guards the same hydration race from the other side: a controlled input that
  // React re-mounts under us would lose the typed value silently.
  await expect(accountField).toHaveValue(account)

  await page.getByRole('button', { name: 'Generar' }).click()
}

// -------------------------------------------------------------------------
// Case 1 — A completed run shows each reel's analysis and script (happy path)
// Traces to: 5.1, 5.2, 5.3, 5.4, 5.5
// -------------------------------------------------------------------------
test('a completed run shows every reel with its analysis, its script and a working copy control', async ({
  page,
}) => {
  const runId = 'run_e2e_1'

  const running = {
    runId,
    account: 'morningbrew',
    actor: 'juanse',
    status: 'running',
    reels: [
      {
        rank: 1,
        shortcode: 'r1',
        thumbnailUrl: '',
        metrics: METRICS_1,
        status: 'pending',
        currentStep: 'transcribe',
      },
      {
        rank: 2,
        shortcode: 'r2',
        thumbnailUrl: '',
        metrics: METRICS_2,
        status: 'pending',
        currentStep: 'download',
      },
    ],
  }

  const completed = {
    runId,
    account: 'morningbrew',
    actor: 'juanse',
    status: 'completed',
    reels: [
      okReel(1, 'r1', METRICS_1, 'HOOK UNO', 'CUERPO UNO', 'CIERRE UNO'),
      okReel(2, 'r2', METRICS_2, 'HOOK DOS', 'CUERPO DOS', 'CIERRE DOS'),
    ],
  }

  // The first poll returns `running`; the run only turns `completed` once the
  // test has seen the running view. Gating the transition on the test rather
  // than on the 2 s poll clock keeps the assertions off a race the plan itself
  // warns about, while still exercising the transition through a later poll —
  // the completed view never arrives on the first response.
  let phase: 'running' | 'completed' = 'running'

  await page.route(POST_RUNS, (route) => json(route, 201, { runId }))
  await page.route(new RegExp(`/api/runs/${runId}$`), (route) =>
    json(route, 200, phase === 'running' ? running : completed),
  )

  // 5.5 — the copy control writes to the real clipboard.
  await page.context().grantPermissions(['clipboard-write'])

  await page.goto('/')

  // 5.2 — the actor list is built from `profiles/`, which holds exactly `juanse`.
  const actorSelect = page.getByLabel('Actor')
  await expect(actorSelect.getByRole('option')).toHaveText(['juanse'])
  await expect(actorSelect).toHaveValue('juanse')

  // The plan leaves "Reels" at its default.
  await expect(page.getByLabel('Reels')).toHaveValue('3')

  await startRun(page, 'morningbrew')

  // 5.1 — the id the API returned reached the page.
  await expect(page.getByText(`Run: ${runId}`)).toBeVisible()

  // 5.3 — the step in flight is reported per reel: two different steps show at
  // the same time. `exact` keeps each match on the step's own <span> instead of
  // also matching its <li>. `Iniciando…` is deliberately never asserted.
  await expect(page.getByText('transcribe', { exact: true })).toBeVisible()
  await expect(page.getByText('download', { exact: true })).toBeVisible()

  // Let the run finish; the completed view can only arrive on a later poll.
  phase = 'completed'

  // 5.4 — rank, metrics, analysis and script, scoped to the card. Every card
  // repeats the "Análisis"/"Script" headings, so page-wide text would be
  // ambiguous and would not prove the content sits on the right reel.
  const reel1 = page.getByTestId('reel-1')
  await expect(reel1.getByRole('heading', { name: '#1' })).toBeVisible()
  await expect(reel1).toContainText('6900000 views')
  await expect(reel1).toContainText('412000 likes')
  await expect(reel1).toContainText('1820 comments')

  await expect(reel1.getByRole('heading', { name: 'Análisis' })).toBeVisible()
  await expect(reel1.getByText('Reformular un dato conocido')).toBeVisible()
  await expect(reel1.getByText('Abre con una contradicción')).toBeVisible()
  await expect(reel1.getByText('Nombra un número duro')).toBeVisible()

  await expect(reel1.getByRole('heading', { name: 'Script' })).toBeVisible()
  await expect(reel1.getByText('HOOK UNO')).toBeVisible()
  await expect(reel1.getByText('CUERPO UNO')).toBeVisible()
  await expect(reel1.getByText('CIERRE UNO')).toBeVisible()

  // 5.4 — the second reel carries its own script, not the first one's.
  const reel2 = page.getByTestId('reel-2')
  await expect(reel2.getByRole('heading', { name: '#2' })).toBeVisible()
  await expect(reel2.getByText('HOOK DOS')).toBeVisible()

  // 5.5 — one copy control per successful reel, and clicking it confirms.
  const copy1 = reel1.getByRole('button', { name: 'Copiar script' })
  await expect(copy1).toHaveCount(1)
  await expect(reel2.getByRole('button', { name: 'Copiar script' })).toHaveCount(1)

  await copy1.click()
  // The button renders "No se pudo copiar" when the clipboard promise rejects,
  // so this asserts the copy actually happened, not just that a click landed.
  await expect(reel1.getByRole('button')).toHaveText('Copiado')
})

// -------------------------------------------------------------------------
// Case 2 — An expired Instagram cookie aborts the run and tells the operator
//          what to do (failure path)
// Traces to: 7.3 (and the same aborted-render path as 1.5, 4.5 and 7.2)
// -------------------------------------------------------------------------
test('an aborted run shows the operator instruction verbatim and stops polling', async ({
  page,
}) => {
  const runId = 'run_e2e_2'
  const MESSAGE =
    'Instagram rejected the request with HTTP 403 — the session cookie has expired. Rotate IG_SESSIONID with a fresh cookie from a disposable account.'

  const aborted = {
    runId,
    account: 'morningbrew',
    actor: 'juanse',
    status: 'aborted',
    error: { code: 'ig-session-expired', message: MESSAGE },
    reels: [],
  }

  const pollUrl = new RegExp(`/api/runs/${runId}$`)
  let polls = 0

  await page.route(POST_RUNS, (route) => json(route, 201, { runId }))
  await page.route(pollUrl, (route) => {
    polls += 1
    return json(route, 200, aborted)
  })

  await page.goto('/')
  await startRun(page, 'morningbrew')

  // 7.3 — the whole rotate-the-cookie instruction reaches the screen, verbatim.
  // Scoped to <main>: Next.js keeps its own empty role="alert" route announcer
  // in a shadow root outside the app's markup.
  const alert = page.locator('main').getByRole('alert')
  await expect(alert).toHaveText(MESSAGE)

  // A run that aborted produced no reels, so no card may be rendered. Attribute
  // selector: "any reel card" is not expressible as a role or a label.
  await expect(page.locator('[data-testid^="reel-"]')).toHaveCount(0)

  // Polling stops on a terminal status. Proving an *absence* needs a real
  // observation window, so this waits ~5 s — past two 2 s poll intervals. It is
  // not a synchronisation sleep: `waitForRequest` resolves early (and the
  // assertion below fails fast) the moment a rogue poll fires.
  const pollsWhenAborted = polls
  const roguePoll = await page
    .waitForRequest((request) => pollUrl.test(request.url()) && request.method() === 'GET', {
      timeout: 5_000,
    })
    .then(
      () => true,
      () => false,
    )

  expect(roguePoll).toBe(false)
  expect(polls).toBe(pollsWhenAborted)
})

// -------------------------------------------------------------------------
// Case 3 — A reel that failed shows its reason, and the rest still deliver
//          (failure path)
// Traces to: 5.6, 6.2, and the user-visible half of 6.1
// -------------------------------------------------------------------------
test('a failed reel shows its reason while its siblings still deliver their scripts', async ({
  page,
}) => {
  const runId = 'run_e2e_3'

  const completed = {
    runId,
    account: 'morningbrew',
    actor: 'juanse',
    status: 'completed',
    reels: [
      okReel(1, 'r1', METRICS_1, 'HOOK UNO', 'CUERPO UNO', 'CIERRE UNO'),
      {
        rank: 2,
        shortcode: 'r2',
        thumbnailUrl: '',
        metrics: METRICS_2,
        status: 'failed',
        failedStep: 'download',
        reason: 'video not available (404)',
      },
      okReel(3, 'r3', METRICS_3, 'HOOK TRES', 'CUERPO TRES', 'CIERRE TRES'),
    ],
  }

  await page.route(POST_RUNS, (route) => json(route, 201, { runId }))
  await page.route(new RegExp(`/api/runs/${runId}$`), (route) => json(route, 200, completed))

  await page.goto('/')
  await startRun(page, 'morningbrew')

  await expect(page.locator('[data-testid^="reel-"]')).toHaveCount(3)

  // 6.1 (user-visible half) — the failed reel keeps its identity instead of
  // being dropped: it is still a card, and it still shows its metrics.
  const failed = page.getByTestId('reel-2')
  await expect(failed.getByRole('heading', { name: '#2' })).toBeVisible()
  await expect(failed).toContainText('1200000 views')

  // 5.6 — the reason stands *in place of* the analysis and the script.
  await expect(failed.getByRole('alert')).toHaveText('video not available (404)')
  await expect(failed.getByRole('button', { name: 'Copiar script' })).toHaveCount(0)
  await expect(failed.getByRole('heading', { name: 'Análisis' })).toHaveCount(0)
  await expect(failed.getByRole('heading', { name: 'Script' })).toHaveCount(0)

  // 6.2 — one broken reel does not cost the batch.
  const reel1 = page.getByTestId('reel-1')
  await expect(reel1.getByText('HOOK UNO')).toBeVisible()
  await expect(reel1.getByText('CUERPO UNO')).toBeVisible()
  await expect(reel1.getByText('CIERRE UNO')).toBeVisible()
  await expect(reel1.getByRole('button', { name: 'Copiar script' })).toHaveCount(1)

  const reel3 = page.getByTestId('reel-3')
  await expect(reel3.getByText('HOOK TRES')).toBeVisible()
  await expect(reel3.getByText('CUERPO TRES')).toBeVisible()
  await expect(reel3.getByText('CIERRE TRES')).toBeVisible()
  await expect(reel3.getByRole('button', { name: 'Copiar script' })).toHaveCount(1)

  // Regression guard: three cards, in rank order, none shuffled or dropped.
  // The rank headings are the only level-3 headings on the page.
  await expect(page.getByRole('heading', { level: 3 })).toHaveText(['#1', '#2', '#3'])
})
