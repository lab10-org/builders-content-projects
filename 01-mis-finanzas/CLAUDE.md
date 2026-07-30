# Manejo de mis finanzas personales

Proyecto de ejemplo para una app de **finanzas personales** que ayuda a crear los presupuestos y categorizar los gastos

## Stack

- TypeScript + Node
- Vitest (tests)

## Comandos de verificación

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run
```

## Workflow de trabajo

`/brainstorming` (definición) → `/specify` (spec en `docs/`) → `/planning-tasks` (convergencia del plan) → ejecución (TDD) → verificación → commit

- **`/brainstorming`** — explora la idea y termina con un diseño aprobado. Al aprobarlo, enlaza con `/specify`.
- **`/specify`** — formaliza el diseño aprobado en `docs/specs/<YYYY-MM-DD>-<feature>/`: primero `requirements.md` (criterios EARS), pausa para aprobación; luego `design.md`, pausa. La Fase 3 (`tasks.md`) no se escribe a mano: se delega en `/planning-tasks`.
- **`/planning-tasks`** — asegura el input (spec con `requirements.md` y `design.md` aprobados) y lanza el workflow `converge-tasks` (`.claude/workflows/converge-tasks.js`), que hace toda la planeación: bootstrap si no existe, fan-out de planners read-only por tarea, síntesis, y un único write de `tasks.md`. También sirve para re-planear o auditar tras un cambio de spec. Termina relayando el reporte del workflow y presentando el plan para aprobación del usuario.
- **`converge-tasks`** (workflow) — el motor de planeación: subagentes `planner` (`.claude/agents/planner.md`) son **read-only** (solo juzgan y proponen); el workflow reconcilia sus propuestas en un paso de síntesis y es el único que escribe `tasks.md`.
- Con el `tasks.md` aprobado, pasa a la ejecución en TDD, registrando en cada tarea su Decision log y Outcome.
- **`task-verifier`** (subagente, `.claude/agents/task-verifier.md`) — cierra cada tarea: recibe la carpeta del spec y **un** ID de tarea, lee los criterios a los que traza y el design, corre `npm run typecheck` y `npm test`, y juzga si el código cumple el criterio **y la intención** (detecta tests que pasan en vacío). Es **read-only** sobre el repo: devuelve un veredicto (PASS / FAIL / INCONCLUSIVE) con evidencia y el texto propuesto del Outcome; quien lo invoca es el único que escribe `tasks.md`. Úsalo antes de marcar una tarea como `Done`, o para auditar una que ya lo está.

## Navegador

Para cualquier automatización de navegador (abrir la app, hacer clic, llenar formularios,
screenshots, leer la consola) usa el MCP **Playwright** (`mcp__playwright__*`), configurado en
`.mcp.json`. **No** uses `claude-in-chrome`: está denegado en `.claude/settings.json`.

## Reglas

- Una feature a la vez. No abrir frentes en paralelo.
- TDD: test que falla → implementar → test que pasa.
- No agregar dependencias sin necesidad.
