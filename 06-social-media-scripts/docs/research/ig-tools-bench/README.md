# Benchmark: instaloader vs insta-fetcher

Compara ambas librerías para descargar reels de Instagram (video + caption + metadata).

## Set up

```bash
uv venv .venv && uv pip install --python .venv/bin/python instaloader
npm install
```

## Sesión (opcional para instaloader, obligatoria para insta-fetcher)

`insta-fetcher` devuelve 403 sin cookie. Para correr el benchmark autenticado,
pon tu `sessionid` en un `.env` local (ignorado por git):

1. Chrome → instagram.com → DevTools (`Cmd+Opt+I`) → **Application** → Storage →
   Cookies → `https://www.instagram.com` → fila `sessionid` → copia el **Value**.
2. Crea el archivo sin que el valor quede en el historial del shell:

```bash
printf 'IG_SESSIONID=%s\n' 'PEGA_AQUI_EL_VALOR' > .env
```

> El `sessionid` da acceso completo a la cuenta. No lo compartas ni lo commitees.
> Se revoca cerrando sesión en Instagram (Configuración → Accesos → cerrar sesión).

## Correr

```bash
set -a && source .env && set +a
./.venv/bin/python bench_instaloader.py
node bench_instafetcher.mjs
```

Resultados crudos en `results/*.json`, videos en `out/`.
