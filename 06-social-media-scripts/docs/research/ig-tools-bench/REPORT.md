# instaloader vs insta-fetcher — reporte de evaluación

**Fecha:** 2026-08-06 · **Veredicto:** `insta-fetcher` como principal, `instaloader` como complemento opcional.

## Setup

| | instaloader | insta-fetcher |
|---|---|---|
| Versión | 4.15.3 (26-jul-2026) | 1.4.0 (23-mar-2026) |
| Runtime | Python 3.13 | Node 22 |
| Endpoint que usa | `www.instagram.com/graphql/query` (web) | `i.instagram.com/api/v1` (móvil) |
| Deps | `requests` | `axios`, `big-integer`, `form-data` |
| Licencia | MIT | MIT |

**Set de prueba:** 6 reels reales (`nasa` ×3, `openai` ×3) capturados de la sesión autenticada de Chrome.
**Auth:** `sessionid` en `.env`, misma cuenta para ambas. macOS, una corrida por benchmark.

---

## 1. Velocidad — un reel suelto (6 reels, autenticado)

| | instaloader | insta-fetcher | ratio |
|---|---:|---:|---:|
| Metadata | **9.45 s** | **0.94 s** | **10.1×** |
| Descarga de video | 2.40 s | 2.43 s | 1.0× |
| **Total por reel** | **11.85 s** | **3.37 s** | **3.5×** |
| Éxito | 6/6 | 6/6 | — |

La descarga del video empata (7.37 MB en ambos, mismo CDN — es red, no librería).
Toda la diferencia está en la metadata.

**Por qué:** perfilé instaloader y su rate-limiter interno duerme **0.00 s** — no es throttling
propio. Son 3–12 s de latencia real del endpoint GraphQL web contra 0.45 s del `api/v1` móvil
que usa insta-fetcher. Es una diferencia arquitectónica, no de implementación.

### Modo anónimo (sin cookie)

| | instaloader | insta-fetcher |
|---|---|---|
| Éxito | 6/6 (10.61 s metadata) | **0/6 — HTTP 403 en todo** |
| Comentarios | ❌ `LoginRequiredException` | ❌ |
| Views / duración / música | ❌ null | ❌ |

insta-fetcher **exige** `sessionid`. instaloader funciona anónimo pero degradado.

---

## 2. Velocidad — workload real (últimos 10 reels de una cuenta, con caption + video + métricas)

Este es tu caso de uso: barrer North Star Accounts.

| Cuenta | instaloader | insta-fetcher (seq) | insta-fetcher (par ×5) |
|---|---:|---:|---:|
| `nasa` | 40.65 s → 8 reels (**5.08 s/reel**) | 7.43 s → 10 (**0.74 s/reel**) | 2.62 s → 10 (**0.26 s/reel**) |
| `openai` | **❌ error 400** | 6.57 s → 10 (0.66 s/reel) | 6.01 s → 10 |

**7× a 19× más rápido.** Dos causas además de la latencia:

1. instaloader no tiene endpoint de reels: itera el timeline completo y filtra por `is_video`.
   Escaneó **25 posts para encontrar 8 reels**. insta-fetcher pega al endpoint de clips y
   devuelve 10 reels directo.
2. insta-fetcher paraleliza sin problema (Node async). instaloader es síncrono.

> ⚠️ El listado de clips trae **solo métricas** (likes, comments, play_count, thumbnail).
> Caption, URL de video, duración y música necesitan una 2ª llamada por reel — ya está
> incluida en los tiempos de arriba.

---

## 3. Fiabilidad — descubrimiento de perfil (8 cuentas)

| | instaloader | insta-fetcher |
|---|---:|---:|
| Correctas | **4/8** | **8/8** |

instaloader falla de forma **reproducible** en `openai`, `natgeo`, `vercel` y `github`:

```
QueryReturnedBadRequestException: 400 Bad Request — "fail" status, message
"Asset asset://laser.provider/ig_business_category_subvertical has been deleted.
 You cannot use this schema"
```

Instagram borró ese campo y la query de perfil de instaloader lo sigue pidiendo. **Afecta a
cuentas business/creator** — es decir, exactamente el tipo de cuenta que serían tus North Star
Accounts. Es un problema conocido del proyecto ([#2029](https://github.com/instaloader/instaloader/issues/2029),
[#2695](https://github.com/instaloader/instaloader/issues/2695)).

`anthropicai` dio "vacío" en insta-fetcher, pero instaloader confirma que la cuenta no tiene
posts — coinciden, no es un fallo.

**Matiz importante:** el fallo es del path de **perfil**. `Post.from_shortcode` funcionó 6/6.
instaloader sirve si ya tienes los shortcodes; no sirve para descubrirlos en cuentas business.

---

## 4. Cantidad de data

Empate en volumen (**18.3 / 28** campos de negocio cada una) pero **el contenido es complementario**:

| Campo | instaloader | insta-fetcher |
|---|:---:|:---:|
| shortcode, media_id, owner, fecha | ✅ | ✅ |
| caption | ✅ | ✅ |
| likes | ✅ | ✅ |
| comment_count | ✅ | ✅ |
| video_url + thumbnail | ✅ | ✅ |
| **texto de comentarios** (+autor, +likes) | ✅ 5 en 0.79 s | ❌ `preview_comments` vacío |
| **hashtags / mentions parseados** | ✅ nativo | ⚠️ regex propio |
| **tagged_users** | ✅ | ✅ (raw) |
| **owner_followers / is_verified** | ✅ | ✅ (raw) |
| **views (play_count)** | ❌ null 0/6 | ✅ 6/6 (6.9 M en el reel de NASA) |
| **video_duration** | ❌ null 0/6 | ✅ 6/6 (32.45 s) |
| **música (título/artista)** | ❌ null 0/6 | ✅ 6/6 |
| location | ❌ null | ❌ null |

- **Solo instaloader:** texto de comentarios.
- **Solo insta-fetcher:** views, duración, música. El raw de `api/v1` trae ~301 hojas por reel.

Para analizar qué contenido funciona, **views es la métrica más importante** y instaloader no la da.

---

## 5. Operación y riesgo

| | instaloader | insta-fetcher |
|---|---|---|
| Mantenimiento | ✅ activo (jul-2026), comunidad grande | ⚠️ npm mar-2026, issues sin responder desde nov-2024 |
| Popularidad | Muy alta | Baja (412 descargas/semana) |
| Tipos TS | n/a (Python) | ✅ precisos y al día |
| Rate limiting | ✅ controlador incorporado | ❌ tú lo implementas |
| Anónimo | ✅ (degradado) | ❌ |
| Riesgo de ban | Bajo si anónimo | **Alto** — cookie obligatoria |

**Riesgo principal de insta-fetcher:** requiere `sessionid` de una cuenta real siempre. Si
Instagram marca el scraping, se cae esa cuenta. **Usa una cuenta quemable, no la de Lab10.**

**Riesgo principal de instaloader:** su path de perfil ya está roto para cuentas business y
depende de que el proyecto actualice la query.

---

## Recomendación

**`insta-fetcher` como principal.** Gana en tus dos criterios declarados:

- **Velocidad:** 3.5× por reel suelto, 7–19× en el workload real de barrer cuentas.
- **Data:** empata en volumen y aporta **views, duración y música**, que instaloader no da y que
  son justo lo que necesitas para decidir qué contenido replicar.

Y desempata la fiabilidad: **8/8 vs 4/8** en descubrimiento de perfil, con instaloader roto
precisamente en cuentas business.

**`instaloader` como complemento opcional**, solo si quieres el **texto de los comentarios**
(insta-fetcher no lo expone). Úsalo vía `Post.from_shortcode` sobre shortcodes que ya
descubriste con insta-fetcher — ese path sí funciona 6/6 — nunca para descubrir perfiles.

### Arquitectura sugerida

```
1. insta-fetcher · fetchUserReel(cuenta)        → shortcodes + likes/comments/views   (~2 s / 10 reels)
2. insta-fetcher · fetchPostByMediaId(pk)       → caption + video_url + duración      (~0.45 s c/u, paralelizable ×5)
3. fetch(video_url)                             → descarga del mp4                    (~2.4 s c/u)
4. [opcional] instaloader · Post.from_shortcode → texto de comentarios                (~0.8 s c/u)
```

### Antes de producción

- [ ] Cuenta de Instagram **quemable** para el `sessionid`, no la de Lab10.
- [ ] Rate limiting propio (insta-fetcher no trae). Paralelismo ×5 fue estable; no subiría más.
- [ ] Manejo de rotación de cookie: el `sessionid` expira, necesitas detectar el 403 y avisar.
- [ ] Pinear `insta-fetcher@1.4.0` — proyecto pequeño y poco mantenido, un cambio de IG lo rompe.

---

## Limitaciones de esta evaluación

- 6 reels de 2 cuentas para el test unitario; 8 cuentas para fiabilidad. Muestra chica.
- Una corrida por benchmark, sin promediar varias — la latencia de IG varía bastante
  (el fetch core de instaloader osciló entre 3.26 s y 12.00 s).
- Una sola red y una sola cuenta de sesión. Los tiempos absolutos van a cambiar; los
  **ratios** entre herramientas deberían mantenerse.
- No probé cuentas privadas, carruseles ni stories.

## Reproducir

```bash
cd ig-tools-bench && set -a && source .env && set +a
./.venv/bin/python bench_instaloader.py   # unitario
node bench_instafetcher.mjs
./.venv/bin/python e2e.py                 # workload real
PARALLEL=5 node e2e.mjs
./.venv/bin/python reliability.py         # fiabilidad
node reliability.mjs
./.venv/bin/python compare.py             # tabla consolidada
```
