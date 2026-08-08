# Scripts para reels de Instagram

Genera los scripts que un miembro de Lab10 tiene que grabar, a partir de los
reels que mejor funcionaron en una cuenta de referencia (*North Star Account*).

Dada una cuenta y un actor, el sistema descubre sus reels recientes, se queda con
los más vistos, les extrae el audio, los transcribe, analiza qué estaban
haciendo y para quién, y escribe un script en español con la forma de hablar de
esa persona.

## Requisitos

- **Node 22+**
- **ffmpeg** en el `PATH` (`brew install ffmpeg` en macOS). El sistema lo
  verifica al arrancar cada run y aborta con un mensaje claro si falta.
- Una **cuenta de Instagram desechable** para el `sessionid` (ver abajo).
- Una API key de **OpenRouter**.

## Configuración

```bash
npm install
cp .env.local.example .env.local
```

Completá `.env.local` con las dos variables:

| Variable | Para qué |
|---|---|
| `IG_SESSIONID` | Cookie de sesión de Instagram. `insta-fetcher` no funciona anónimo. |
| `OPENROUTER_API_KEY` | Transcripción y los dos pasos de LLM, todo por OpenRouter. |

## ⚠️ El `IG_SESSIONID` va de una cuenta desechable

**El `IG_SESSIONID` tiene que salir de una cuenta de Instagram desechable, creada
para esto y para nada más. Nunca uses la cuenta de Lab10 ni la personal de nadie.**
El scraping puede hacer que Instagram marque y bloquee la cuenta dueña de esa
cookie, y si esa cuenta es la de Lab10 perdés la cuenta, no el scraper.

Cuando la cookie expira, los runs abortan con el mensaje *"the session cookie has
expired"*. Para rotarla: entrá a Instagram con la cuenta desechable, copiá el
valor de la cookie `sessionid` desde las herramientas de desarrollo del navegador,
pegalo en `.env.local` y reiniciá el servidor.

## Perfiles de actor

Cada persona que graba tiene un archivo en **`profiles/`**, por ejemplo
`profiles/juanse.md`, escrito a mano con su tono, sus muletillas, los temas que
domina, el formato que prefiere y un par de scripts suyos de ejemplo. El
selector de actores de la página ofrece exactamente los perfiles que existan en
esa carpeta, así que agregar una persona es agregar un archivo.

El contenido del perfil se le pasa al modelo tal cual, sin parsear — está pensado
para que lo edite su dueño, no un programa.

## Correr la app

```bash
npm run dev
```

Abrí `http://localhost:3000`, elegí la cuenta, el actor y cuántos reels querés, y
dale a *Generar*. La página muestra el paso en el que va cada reel y, al
terminar, el análisis y el script de cada uno, con un botón para copiarlo.

Un run tarda varios minutos, así que la app **tiene que correr como un proceso
Node de vida larga** (`npm run dev` o `npm run build && npm start`). Un deploy
serverless cortaría el run a la mitad.

## Verificación

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run
```

La suite corre sin red y sin API keys: todos los adaptadores se inyectan.

## Modelos

Los tres modelos de OpenRouter están fijados en `src/lib/models.ts` — uno para
transcripción, uno para el análisis y uno para la generación. Cambiarlos es
cambiar ese archivo.
