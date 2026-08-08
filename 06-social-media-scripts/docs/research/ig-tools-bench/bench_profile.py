"""Workload real: traer los últimos N reels de una cuenta (North Star Account)."""
import os, time, json
import instaloader

N = 12
ACCOUNTS = ["nasa", "openai"]
SESSIONID = os.environ.get("IG_SESSIONID", "").strip()

L = instaloader.Instaloader(quiet=True, save_metadata=False, download_comments=False)
if SESSIONID:
    L.context._session.cookies.set("sessionid", SESSIONID, domain=".instagram.com")
    try:
        L.context.username = L.test_login()
    except Exception as e:
        print("[warn] test_login:", e)

out = []
for acc in ACCOUNTS:
    t0 = time.perf_counter()
    try:
        prof = instaloader.Profile.from_username(L.context, acc)
        t_prof = time.perf_counter() - t0
        t1 = time.perf_counter()
        reels, n_req = [], 0
        for p in prof.get_posts():
            if p.is_video:
                reels.append({"shortcode": p.shortcode, "likes": p.likes, "comments": p.comments,
                              "caption_len": len(p.caption or ""), "date": p.date_utc.isoformat(),
                              "video_url": bool(p.video_url)})
            n_req += 1
            if len(reels) >= N or n_req >= 30:
                break
        t_posts = time.perf_counter() - t1
        row = {"account": acc, "status": "ok", "t_profile_s": round(t_prof, 2),
               "t_posts_s": round(t_posts, 2), "t_total_s": round(t_prof + t_posts, 2),
               "reels": len(reels), "posts_scanned": n_req,
               "s_per_reel": round((t_prof + t_posts) / max(len(reels), 1), 2)}
    except Exception as e:
        row = {"account": acc, "status": "error", "error": f"{type(e).__name__}: {str(e)[:200]}",
               "t_total_s": round(time.perf_counter() - t0, 2)}
    print(json.dumps(row, ensure_ascii=False))
    out.append(row)

json.dump({"tool": "instaloader", "workload": f"últimos {N} reels por cuenta", "results": out},
          open("results/profile_instaloader.json", "w"), indent=1, ensure_ascii=False)
