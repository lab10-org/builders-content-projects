"""Desglosa dónde se va el tiempo en instaloader: fetch core vs campos lazy vs rate-limiter."""
import json, os, time
import instaloader

SC = ["Dbn-XJhk0_-", "DbluoPsmhmo", "DbbSK7rD-SW"]
SESSIONID = os.environ.get("IG_SESSIONID", "").strip()

L = instaloader.Instaloader(quiet=True, save_metadata=False, download_comments=False)
if SESSIONID:
    L.context._session.cookies.set("sessionid", SESSIONID, domain=".instagram.com")

# instrumentar el rate controller para medir cuánto tiempo pasa DURMIENDO a propósito
slept = {"total": 0.0}
rc = L.context._rate_controller
orig_sleep = rc.sleep


def traced_sleep(secs):
    slept["total"] += secs
    return orig_sleep(secs)


rc.sleep = traced_sleep

for sc in SC:
    slept["total"] = 0.0
    t0 = time.perf_counter()
    p = instaloader.Post.from_shortcode(L.context, sc)
    t_core = time.perf_counter() - t0
    sleep_core = slept["total"]

    # campos que NO cuestan request extra (vienen en el payload del post)
    t0 = time.perf_counter()
    _ = (p.likes, p.comments, p.caption, p.caption_hashtags, p.caption_mentions,
         p.video_url, p.date_utc, p.owner_username, p.owner_id, p.is_video, p.mediaid)
    t_cheap = time.perf_counter() - t0

    # campos lazy que SÍ disparan request extra
    slept["total"] = 0.0
    t0 = time.perf_counter()
    try:
        _ = (p.owner_profile.followers, p.owner_profile.is_verified)
        err = None
    except Exception as e:
        err = type(e).__name__
    t_owner = time.perf_counter() - t0
    sleep_owner = slept["total"]

    slept["total"] = 0.0
    t0 = time.perf_counter()
    try:
        n = 0
        for _c in p.get_comments():
            n += 1
            if n >= 5:
                break
        cerr = None
    except Exception as e:
        n, cerr = 0, type(e).__name__
    t_comments = time.perf_counter() - t0
    sleep_comments = slept["total"]

    print(f"{sc}: core={t_core:5.2f}s (sleep {sleep_core:4.2f}) | campos_baratos={t_cheap*1000:5.1f}ms | "
          f"owner_profile={t_owner:5.2f}s (sleep {sleep_owner:4.2f}) {err or ''} | "
          f"comments={t_comments:5.2f}s (sleep {sleep_comments:4.2f}) n={n} {cerr or ''}")
