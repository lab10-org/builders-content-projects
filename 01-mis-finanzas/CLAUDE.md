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

`/brainstorming` (definición) → `/specify` (spec en `docs/`) → ejecución (TDD) → verificación → commit

- **`/brainstorming`** — explora la idea y termina con un diseño aprobado. Al aprobarlo, enlaza con `/specify`.
- **`/specify`** — formaliza el diseño aprobado en `docs/specs/<YYYY-MM-DD>-<feature>/`: primero `requirements.md` (criterios EARS), pausa para aprobación; luego `design.md`, pausa; luego `tasks.md` (lista de tareas TDD que además sirve de bitácora de decisiones).
- Con el `tasks.md` aprobado, pasa a la ejecución en TDD, registrando en cada tarea su Decision log y Outcome.

## Reglas

- Una feature a la vez. No abrir frentes en paralelo.
- TDD: test que falla → implementar → test que pasa.
- No agregar dependencias sin necesidad.
