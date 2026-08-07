"""Consolida results/*.json en una tabla comparativa."""
import json, pathlib, statistics as st

ROOT = pathlib.Path(__file__).parent
R = ROOT / "results"


def load(name):
    p = R / name
    return json.loads(p.read_text()) if p.exists() else None


def agg(rows, key):
    vals = [r[key] for r in rows if isinstance(r.get(key), (int, float))]
    return round(st.mean(vals), 2) if vals else None


def line(label, a, b, unit=""):
    fa = "—" if a is None else f"{a}{unit}"
    fb = "—" if b is None else f"{b}{unit}"
    print(f"{label:<34} {fa:>16} {fb:>16}")


il, iff = load("instaloader.json"), load("instafetcher.json")
print(f"{'':<34} {'instaloader':>16} {'insta-fetcher':>16}")
print("-" * 68)

il_ok = [r for r in (il["results"] if il else []) if r["status"] == "ok"]
if_ok = [r for r in (iff["results"] if iff else []) if r["status"] == "ok"]

line("modo", il["mode"] if il else None, iff["mode"] if iff else None)
line("éxito", f"{len(il_ok)}/{len(il['results'])}" if il else None,
     f"{len(if_ok)}/{len(iff['results'])}" if iff else None)
line("metadata (avg)", agg(il_ok, "t_metadata_s"), agg(if_ok, "t_fetchPost_s"), "s")
line("metadata raw/rico (avg)", None, agg(if_ok, "t_raw_s"), "s")
line("descarga video (avg)", agg(il_ok, "t_video_s"), agg(if_ok, "t_video_s"), "s")
line("campos de negocio (avg)", agg(il_ok, "fields_ok"), agg(if_ok, "fields_ok"))
line("campos de negocio (total)", il_ok[0]["fields_total"] if il_ok else None,
     if_ok[0]["fields_total"] if if_ok else None)
line("hojas en raw (avg)", None, agg(if_ok, "raw_leaf_count"))
mb = lambda rows: round(st.mean([r["video_bytes"] for r in rows if r.get("video_bytes")]) / 1e6, 2) if any(r.get("video_bytes") for r in rows) else None
line("peso video (avg)", mb(il_ok), mb(if_ok), " MB")

# tiempo total por reel (metadata + video), la métrica que importa en pipeline
tot_il = agg(il_ok, "t_metadata_s") or 0
tot_il += agg(il_ok, "t_video_s") or 0
tot_if = (agg(if_ok, "t_fetchPost_s") or 0) + (agg(if_ok, "t_raw_s") or 0) + (agg(if_ok, "t_video_s") or 0)
print("-" * 68)
line("TOTAL por reel (avg)", round(tot_il, 2) or None, round(tot_if, 2) or None, "s")

if il_ok:
    c = il_ok[0].get("comments_text", {})
    print(f"\ncomentarios (texto) instaloader: {'OK ' + str(c.get('count')) if c.get('ok') else c.get('error', '—')}")
if if_ok:
    cp = if_ok[0]["fields"].get("comments_preview")
    print(f"comentarios (texto) insta-fetcher: {'OK ' + str(len(cp)) if cp else '— (no expuesto)'}")
