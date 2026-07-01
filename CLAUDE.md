# Prospección B2B — ejemplo de harness

Proyecto de ejemplo para una app de **prospección B2B** que califica prospectos (lead scoring).

## Stack

- TypeScript + Node
- Vitest (tests)

## Comandos de verificación

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run
```

"Terminado" = `npm run typecheck` y `npm test` pasan. No "se ve bien".

## Workflow

```
spec (docs/) → plan (docs/plans/) → ejecución (TDD) → verificación → commit
```

## Reglas

- Una feature a la vez. No abrir frentes en paralelo.
- TDD: test que falla → implementar → test que pasa.
- No agregar dependencias sin necesidad.
