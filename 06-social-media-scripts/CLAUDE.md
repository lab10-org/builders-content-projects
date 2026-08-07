# Sistema de creacion de scripts para reels de social media (Instagram)

## Objetivo de negocio

Ayudar a los miembros de Lab10 a generar el contenido que se debe grabar para Instagram, Lab10 tiene un objetivo de crecmiento en Instagram para agregarle valor a los seguidores y hacerlo de forma consistente.

## Problema actual de negocio

1. Recopilar y analizar los reels, noticias y tendencias del dia es un trabajo muy operativo que consume mucho tiempo
2. Generar los scripts personalizados por cada persona graba requiere tiempo humano

# Objetivo del sistema

1. Obtener la informacion de unas cuentas base (North Star Accounts)
2. Analizar esa informacion
3. Generar los scripts

## Stack

- TypeScript + Node
- Vitest (tests)
- NextJS
- [Mastra.ai](https://mastra.ai/docs): Framework para creacion de workflows y agentes de AI

## Comandos de verificación

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run test:e2e    # playwright test (suite e2e del loop de verificación)
```

## Workflow de trabajo

`/brainstorming` (definición) → `/specify` (spec en `docs/`) → `/planning-tasks` (convergencia del plan) → ejecución (TDD) → `/verify-implementation` (loop e2e) → commit

- **`/brainstorming`** — explora la idea y termina con un diseño aprobado. Al aprobarlo, enlaza con `/specify`.
- **`/specify`** — formaliza el diseño aprobado en `docs/specs/<YYYY-MM-DD>-<feature>/`: primero `requirements.md` (criterios EARS), pausa para aprobación; luego `design.md`, pausa. La Fase 3 (`tasks.md`) no se escribe a mano: se delega en `/planning-tasks`.
- **`/planning-tasks`** — asegura el input (spec con `requirements.md` y `design.md` aprobados) y lanza el workflow `converge-tasks` (`.claude/workflows/converge-tasks.js`), que hace toda la planeación: bootstrap si no existe, fan-out de planners read-only por tarea, síntesis, y un único write de `tasks.md`. También sirve para re-planear o auditar tras un cambio de spec. Termina relayando el reporte del workflow y presentando el plan para aprobación del usuario.
- **`converge-tasks`** (workflow) — el motor de planeación: subagentes `planner` (`.claude/agents/planner.md`) son **read-only** (solo juzgan y proponen); el workflow reconcilia sus propuestas en un paso de síntesis y es el único que escribe `tasks.md`.
- Con el `tasks.md` aprobado, pasa a la ejecución en TDD, registrando en cada tarea su Decision log y Outcome.
- **`task-verifier`** (subagente, `.claude/agents/task-verifier.md`) — cierra cada tarea: recibe la carpeta del spec y **un** ID de tarea, lee los criterios a los que traza y el design, corre `npm run typecheck` y `npm test`, y juzga si el código cumple el criterio **y la intención** (detecta tests que pasan en vacío). Es **read-only** sobre el repo: devuelve un veredicto (PASS / FAIL / INCONCLUSIVE) con evidencia y el texto propuesto del Outcome; quien lo invoca es el único que escribe `tasks.md`. Úsalo antes de marcar una tarea como `Done`, o para auditar una que ya lo está.

## Loop e2e (después de implementar el spec)

Cuando la implementación del spec termina (todas las tareas `Done`, `typecheck` y
`npm test` en verde), arranca el **loop e2e**, que valida la feature contra la app real:

```
/verify-implementation → /plan-test-cases → [generate-tests] → [healer] ─┐
        ▲                                                                │
        └──────────── code defect → corregir en TDD ──────────────────────┘
```

- **`/verify-implementation`** (skill, `.claude/skills/verify-implementation/`) — orquesta el
  loop: valida el gate (tareas `Done`, suite verde, app levantable), llama a los tres
  componentes en orden, lee el veredicto del `healer` y decide si el loop gira otra vez
  (defecto de test → regenerar tests; defecto de código → volver a ejecución en TDD).
  Corta a las 3 vueltas sin verde. **No escribe ninguno de los artefactos.**
- **`/plan-test-cases`** (skill, `.claude/skills/plan-test-cases/`) — deriva del spec
  exactamente **3 casos** (1 happy path + 2 de fallo) y escribe
  `docs/specs/<spec>/e2e-tests-plan.md`. Es su único write.
- **`generate-tests`** (subagente, `.claude/agents/generate-tests.md`) — recorre el flujo real
  con el MCP de Playwright para anclar selectores y copy, y escribe los specs de
  `@playwright/test` en `e2e/`. Es el **único** que escribe en `e2e/`, y nunca toca el código
  de la app para hacer pasar un test.
- **`healer`** (subagente, `.claude/agents/healer.md`) — corre `npm run test:e2e`, reproduce
  los fallos en el navegador y diagnostica, caso por caso, si falla el **test** o el
  **código**. No modifica tests ni código: su único write es
  `docs/specs/<spec>/e2e-tests-report.md`.

Un artefacto, un autor: plan → skill, `e2e/` → `generate-tests`, reporte → `healer`.
Nunca se debilita ni se borra un test para llegar a verde.

## Navegador

Para cualquier automatización de navegador (abrir la app, hacer clic, llenar formularios,
screenshots, leer la consola) usa el MCP **Playwright** (`mcp__playwright__*`), configurado en
`.mcp.json`. **No** uses `claude-in-chrome`: está denegado en `.claude/settings.json`.

## Reglas

- Una feature a la vez. No abrir frentes en paralelo.
- TDD: test que falla → implementar → test que pasa.
- No agregar dependencias sin necesidad.
