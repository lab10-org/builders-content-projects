---
name: brainstorming
description: Usar cuando se esta iniciando con la intencion de implementar un producto o feature nuevo, tambien cuando se tiene poca claridad o los requerimientos son ambiguos.
---

# Brainstorming de Feature

Resuelve la ambigüedad de un feature antes de escribir spec o plan.

## Proceso

1. **Encuadre** — pide una descripción del feature en una oración. Confírmala.
2. **Preguntas** — haz hasta 5 preguntas sobre: actores, comportamiento, disparadores, límites de alcance y criterio de done. Usa `AskQuestion` cuando puedas.
3. **Síntesis** — produce este resumen con las respuestas:

```
## Feature: <nombre>
Descripción: …
Actores: …
Comportamiento: …
Fuera de alcance: …
Done cuando: …
```

4. **Salida** — si quedan dudas, repite desde el paso 2.

## Reglas

- No asumas. Pregunta.
- No diseñes soluciones hasta cerrar el resumen.
