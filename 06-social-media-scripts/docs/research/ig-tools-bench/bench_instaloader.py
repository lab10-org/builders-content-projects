"""Benchmark instaloader: velocidad + cobertura de datos por reel.

Lee IG_SESSIONID del entorno (opcional). Sin ella corre anónimo.
Salida: results/instaloader.json
"""
import json, os, time, pathlib, sys
import instaloader

ROOT = pathlib.Path(__file__).parent
TESTSET = json.loads((ROOT / "testset.json").read_text())["reels"]
OUT = ROOT / "out" / "instaloader"
OUT.mkdir(parents=True, exist_ok=True)

SESSIONID = os.environ.get("IG_SESSIONID", "").strip()
MODE = "authenticated" if SESSIONID else "anonymous"

L = instaloader.Instaloader(quiet=True, save_metadata=False, download_comments=False,
                            compress_json=False, dirname_pattern=str(OUT))
if SESSIONID:
    # instaloader >=4.12: se puede inyectar la cookie de sesión directamente
    L.context._session.cookies.set("sessionid", SESSIONID, domain=".instagram.com")
    try:
        L.context.username = L.test_login()
    except Exception as e:
        print(f"[warn] sessionid presente pero test_login falló: {e}", file=sys.stderr)


def field_inventory(p: instaloader.Post) -> dict:
    """Todos los campos que instaloader expone; None/error => no disponible."""
    probes = {
        "shortcode": lambda: p.shortcode,
        "mediaid": lambda: p.mediaid,
        "typename": lambda: p.typename,
        "is_video": lambda: p.is_video,
        "title": lambda: p.title,
        "caption": lambda: p.caption,
        "caption_hashtags": lambda: p.caption_hashtags,
        "caption_mentions": lambda: p.caption_mentions,
        "tagged_users": lambda: p.tagged_users,
        "likes": lambda: p.likes,
        "comments": lambda: p.comments,
        "video_view_count": lambda: p.video_view_count,
        "video_duration": lambda: p.video_duration,
        "video_url": lambda: p.video_url,
        "url_thumbnail": lambda: p.url,
        "date_utc": lambda: p.date_utc.isoformat(),
        "date_local": lambda: p.date_local.isoformat(),
        "owner_username": lambda: p.owner_username,
        "owner_id": lambda: p.owner_id,
        "owner_followers": lambda: p.owner_profile.followers,
        "owner_is_verified": lambda: p.owner_profile.is_verified,
        "location": lambda: p.location.name if p.location else None,
        "is_sponsored": lambda: p.is_sponsored,
        "sponsor_users": lambda: [u.username for u in p.sponsor_users],
        "is_pinned": lambda: p.is_pinned,
        "accessibility_caption": lambda: p.accessibility_caption,
        "music_title": lambda: (p._full_metadata.get("clips_music_attribution_info") or {}).get("song_name"),
        "music_artist": lambda: (p._full_metadata.get("clips_music_attribution_info") or {}).get("artist_name"),
    }
    inv, ok = {}, 0
    for k, fn in probes.items():
        try:
            v = fn()
            inv[k] = v
            if v is not None and v != [] and v != "":
                ok += 1
        except Exception as e:
            inv[k] = f"__ERR__ {type(e).__name__}"
    return inv, ok


def fetch_comments(p, limit=5):
    """Texto de comentarios: mide si la herramienta los expone de verdad."""
    t = time.perf_counter()
    try:
        items = []
        for c in p.get_comments():
            items.append({"user": c.owner.username, "text": c.text[:80], "likes": c.likes_count})
            if len(items) >= limit:
                break
        return {"ok": True, "count": len(items), "seconds": round(time.perf_counter() - t, 2), "sample": items[:2]}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {str(e)[:150]}", "seconds": round(time.perf_counter() - t, 2)}


results = []
for i, reel in enumerate(TESTSET):
    sc = reel["shortcode"]
    row = {"shortcode": sc, "owner": reel["owner"]}
    try:
        t = time.perf_counter()
        p = instaloader.Post.from_shortcode(L.context, sc)
        inv, ok = field_inventory(p)
        row["t_metadata_s"] = round(time.perf_counter() - t, 2)
        row["fields_ok"] = ok
        row["fields_total"] = len(inv)
        row["fields"] = inv
        row["comments_text"] = fetch_comments(p)

        # descarga del video
        t = time.perf_counter()
        target = OUT / f"{sc}.mp4"
        L.download_pic(str(target.with_suffix("")), p.video_url, p.date_utc)
        row["t_video_s"] = round(time.perf_counter() - t, 2)
        cand = list(OUT.glob(f"{sc}.*"))
        row["video_bytes"] = max((c.stat().st_size for c in cand), default=0)
        row["status"] = "ok"
    except Exception as e:
        row["status"] = "error"
        row["error"] = f"{type(e).__name__}: {str(e)[:250]}"
    print(f"[{i+1}/{len(TESTSET)}] {sc} -> {row['status']} "
          f"meta={row.get('t_metadata_s')}s video={row.get('t_video_s')}s fields={row.get('fields_ok')}")
    results.append(row)
    time.sleep(2)

payload = {"tool": "instaloader", "version": instaloader.__version__, "mode": MODE, "results": results}
(ROOT / "results" / "instaloader.json").write_text(json.dumps(payload, indent=1, ensure_ascii=False, default=str))
ok_rows = [r for r in results if r["status"] == "ok"]
print(f"\n=== instaloader ({MODE}) === ok={len(ok_rows)}/{len(results)}")
if ok_rows:
    print("meta avg:", round(sum(r["t_metadata_s"] for r in ok_rows) / len(ok_rows), 2), "s")
    print("video avg:", round(sum(r["t_video_s"] for r in ok_rows) / len(ok_rows), 2), "s")
    print("fields avg:", round(sum(r["fields_ok"] for r in ok_rows) / len(ok_rows), 1), "/", ok_rows[0]["fields_total"])
