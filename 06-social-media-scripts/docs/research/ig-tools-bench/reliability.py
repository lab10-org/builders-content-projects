"""Fiabilidad: resolver perfil + primer reel en varias cuentas."""
import os, time, json
import instaloader

ACCOUNTS = ["nasa", "openai", "natgeo", "nike", "spotify", "anthropicai", "vercel", "github"]
L = instaloader.Instaloader(quiet=True, save_metadata=False, download_comments=False)
sid = os.environ.get("IG_SESSIONID", "").strip()
if sid:
    L.context._session.cookies.set("sessionid", sid, domain=".instagram.com")
    try:
        L.context.username = L.test_login()
    except Exception as e:
        print("[warn]", e)

out = []
for acc in ACCOUNTS:
    t0 = time.perf_counter()
    try:
        prof = instaloader.Profile.from_username(L.context, acc)
        first = next(iter(prof.get_posts()), None)
        r = {"account": acc, "status": "ok", "t_s": round(time.perf_counter() - t0, 2),
             "followers": prof.followers, "first_post": first.shortcode if first else None}
    except Exception as e:
        r = {"account": acc, "status": "error", "t_s": round(time.perf_counter() - t0, 2),
             "error": type(e).__name__, "msg": str(e)[:110]}
    print(json.dumps(r, ensure_ascii=False))
    out.append(r)
    time.sleep(1.5)

ok = sum(1 for r in out if r["status"] == "ok")
print(f"\ninstaloader fiabilidad: {ok}/{len(out)}")
json.dump({"tool": "instaloader", "results": out}, open("results/reliability_instaloader.json", "w"), indent=1, ensure_ascii=False)
