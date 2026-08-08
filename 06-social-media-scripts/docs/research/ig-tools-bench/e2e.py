"""E2E real: últimos N reels de una cuenta CON métricas + caption + url de video."""
import os, time, json
import instaloader

N = 10
ACCOUNTS = ["nasa", "openai"]
L = instaloader.Instaloader(quiet=True, save_metadata=False, download_comments=False)
sid = os.environ.get("IG_SESSIONID", "").strip()
if sid:
    L.context._session.cookies.set("sessionid", sid, domain=".instagram.com")
    try:
        L.context.username = L.test_login()
    except Exception as e:
        print("[warn] test_login:", e)

out = []
for acc in ACCOUNTS:
    t0 = time.perf_counter()
    row = {"account": acc}
    try:
        prof = instaloader.Profile.from_username(L.context, acc)
        row["t_listing_s"] = round(time.perf_counter() - t0, 2)
        t1 = time.perf_counter()
        full, scanned = [], 0
        for p in prof.get_posts():
            scanned += 1
            if p.is_video:
                full.append({"shortcode": p.shortcode, "likes": p.likes, "comments": p.comments,
                             "play_count": p.video_view_count, "caption": p.caption,
                             "duration": p.video_duration, "video_url": p.video_url,
                             "music": None})
            if len(full) >= N or scanned >= 25:
                break
        row["t_enrich_s"] = round(time.perf_counter() - t1, 2)
        row["t_total_s"] = round(time.perf_counter() - t0, 2)
        row["reels"] = len(full)
        row["posts_scanned"] = scanned
        row["with_caption"] = sum(1 for r in full if r["caption"])
        row["with_video"] = sum(1 for r in full if r["video_url"])
        row["with_views"] = sum(1 for r in full if r["play_count"] is not None)
        row["with_music"] = sum(1 for r in full if r["music"])
        row["s_per_reel"] = round(row["t_total_s"] / max(len(full), 1), 2)
        row["status"] = "ok"
    except Exception as e:
        row["status"] = "error"
        row["error"] = f"{type(e).__name__}: {str(e)[:180]}"
        row["t_total_s"] = round(time.perf_counter() - t0, 2)
    print(json.dumps(row, ensure_ascii=False, default=str)[:400])
    out.append(row)

json.dump({"tool": "instaloader", "results": out}, open("results/e2e_instaloader.json", "w"),
          indent=1, ensure_ascii=False, default=str)
