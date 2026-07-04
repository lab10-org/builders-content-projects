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
- **`/planning-tasks`** — orquesta subagentes `planner` (`.claude/agents/planner.md`) para crear e iterar el `tasks.md`: un bootstrap si no existe, luego una invocación por tarea hasta que el 100% alcance `CRITERIA MET`. También sirve para re-planear o auditar un `tasks.md` existente tras un cambio de spec. Termina presentando el plan para aprobación del usuario.
- Con el `tasks.md` aprobado, pasa a la ejecución en TDD, registrando en cada tarea su Decision log y Outcome.

## Reglas

- Una feature a la vez. No abrir frentes en paralelo.
- TDD: test que falla → implementar → test que pasa.
- No agregar dependencias sin necesidad.
