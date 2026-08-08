import json, time, sys, traceback
import instaloader

SC = "Dbn-XJhk0_-"
L = instaloader.Instaloader(quiet=True, download_comments=False, save_metadata=False)

t0 = time.perf_counter()
try:
    p = instaloader.Post.from_shortcode(L.context, SC)
    fields = {
        "shortcode": p.shortcode,
        "owner": p.owner_username,
        "typename": p.typename,
        "is_video": p.is_video,
        "likes": p.likes,
        "comments": p.comments,
        "video_view_count": p.video_view_count,
        "video_duration": p.video_duration,
        "caption": (p.caption or "")[:120],
        "caption_hashtags": p.caption_hashtags,
        "caption_mentions": p.caption_mentions,
        "date_utc": str(p.date_utc),
        "video_url_present": bool(p.video_url),
    }
    print("OK", round(time.perf_counter() - t0, 2), "s")
    print(json.dumps(fields, indent=1, ensure_ascii=False))
except Exception as e:
    print("FAIL", round(time.perf_counter() - t0, 2), "s")
    print(type(e).__name__, ":", str(e)[:400])
    sys.exit(1)
