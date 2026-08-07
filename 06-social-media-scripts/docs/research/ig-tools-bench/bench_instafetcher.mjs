/**
 * Benchmark insta-fetcher: velocidad + cobertura de datos por reel.
 * Lee IG_SESSIONID del entorno (requerido: la librería no funciona anónima).
 * Salida: results/instafetcher.json
 */
import { igApi, shortcodeToMediaID } from 'insta-fetcher';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TESTSET = JSON.parse(fs.readFileSync(path.join(ROOT, 'testset.json'), 'utf8')).reels;
const OUT = path.join(ROOT, 'out', 'instafetcher');
fs.mkdirSync(OUT, { recursive: true });

const SESSIONID = (process.env.IG_SESSIONID ?? '').trim();
const MODE = SESSIONID ? 'authenticated' : 'anonymous';
if (!SESSIONID) console.warn('[warn] sin IG_SESSIONID: se espera 403 en todo\n');

const ig = new igApi(SESSIONID ? `sessionid=${SESSIONID};` : undefined);
const sec = (t) => Number(((performance.now() - t) / 1000).toFixed(2));

/** Cuenta hojas no vacías de un objeto: proxy de "cantidad de data". */
function countLeaves(o, depth = 0) {
  if (depth > 6 || o == null) return 0;
  if (Array.isArray(o)) return o.slice(0, 5).reduce((a, v) => a + countLeaves(v, depth + 1), 0);
  if (typeof o === 'object') return Object.values(o).reduce((a, v) => a + countLeaves(v, depth + 1), 0);
  return o === '' ? 0 : 1;
}

/** Campos de negocio que importan para el pipeline de scripts. */
function businessFields(flat, raw) {
  const it = raw?.items?.[0] ?? {};
  const cap = it.caption?.text ?? flat?.caption ?? null;
  return {
    shortcode: flat?.shortcode ?? it.code ?? null,
    media_id: flat?.media_id ?? it.id ?? null,
    owner_username: flat?.username ?? it.user?.username ?? null,
    owner_full_name: flat?.name ?? it.user?.full_name ?? null,
    owner_id: it.user?.pk ?? null,
    owner_followers: it.user?.follower_count ?? null,
    owner_is_verified: it.user?.is_verified ?? null,
    caption: cap,
    caption_hashtags: cap ? [...cap.matchAll(/#([\wÀ-ɏ]+)/g)].map(m => m[1]) : null,
    caption_mentions: cap ? [...cap.matchAll(/@([\w.]+)/g)].map(m => m[1]) : null,
    likes: flat?.likes ?? it.like_count ?? null,
    comment_count: flat?.comment_count ?? it.comment_count ?? null,
    play_count: it.play_count ?? null,
    ig_play_count: it.ig_play_count ?? null,
    view_count: it.view_count ?? null,
    reshare_count: it.reshare_count ?? null,
    video_duration: flat?.video_duration ?? it.video_duration ?? null,
    taken_at: flat?.taken_at_timestamp ?? it.taken_at ?? null,
    video_url: flat?.links?.find(l => l.type?.includes('video'))?.url ?? it.video_versions?.[0]?.url ?? null,
    thumbnail_url: it.image_versions2?.candidates?.[0]?.url ?? null,
    music_title: flat?.music?.music_asset_info?.title ?? it.clips_metadata?.music_info?.music_asset_info?.title ?? null,
    music_artist: flat?.music?.music_asset_info?.display_artist ?? it.clips_metadata?.music_info?.music_asset_info?.display_artist ?? null,
    original_audio_title: it.clips_metadata?.original_sound_info?.original_audio_title ?? null,
    location: it.location?.name ?? null,
    tagged_users: it.usertags?.in?.map(u => u.user?.username) ?? null,
    is_paid_partnership: it.is_paid_partnership ?? null,
    accessibility_caption: it.accessibility_caption ?? null,
    comments_preview: it.comments?.slice(0, 3).map(c => ({ user: c.user?.username, text: c.text?.slice(0, 80), likes: c.comment_like_count })) ?? null,
  };
}

const results = [];
for (const [i, reel] of TESTSET.entries()) {
  const row = { shortcode: reel.shortcode, owner: reel.owner };
  try {
    // 1) método de conveniencia (modelo plano)
    let t = performance.now();
    let flat = null, flatErr = null;
    try { flat = await ig.fetchPost(reel.url); } catch (e) { flatErr = `${e?.name}: ${String(e?.message).slice(0, 120)}`; }
    row.t_fetchPost_s = sec(t);
    row.fetchPost_error = flatErr;

    // 2) raw api/v1 (modelo rico)
    t = performance.now();
    let raw = null, rawErr = null;
    try { raw = await ig.fetchPostByMediaId(shortcodeToMediaID(reel.shortcode)); }
    catch (e) { rawErr = `${e?.name}: ${String(e?.message).slice(0, 120)}`; }
    row.t_raw_s = sec(t);
    row.raw_error = rawErr;

    const bf = businessFields(flat, raw);
    row.fields = bf;
    row.fields_ok = Object.values(bf).filter(v => v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)).length;
    row.fields_total = Object.keys(bf).length;
    row.raw_leaf_count = countLeaves(raw?.items?.[0]);

    // 3) descarga del video
    if (bf.video_url) {
      t = performance.now();
      const res = await fetch(bf.video_url);
      const file = path.join(OUT, `${reel.shortcode}.mp4`);
      await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(file));
      row.t_video_s = sec(t);
      row.video_bytes = fs.statSync(file).size;
    }
    row.status = (flat || raw) ? 'ok' : 'error';
    if (row.status === 'error') row.error = flatErr ?? rawErr;
  } catch (e) {
    row.status = 'error';
    row.error = `${e?.name}: ${String(e?.message).slice(0, 200)}`;
  }
  console.log(`[${i + 1}/${TESTSET.length}] ${reel.shortcode} -> ${row.status} ` +
    `flat=${row.t_fetchPost_s}s raw=${row.t_raw_s}s video=${row.t_video_s}s fields=${row.fields_ok}`);
  results.push(row);
  await new Promise(r => setTimeout(r, 2000));
}

fs.writeFileSync(path.join(ROOT, 'results', 'instafetcher.json'),
  JSON.stringify({ tool: 'insta-fetcher', version: '1.4.0', mode: MODE, results }, null, 1));

const ok = results.filter(r => r.status === 'ok');
console.log(`\n=== insta-fetcher (${MODE}) === ok=${ok.length}/${results.length}`);
if (ok.length) {
  const avg = (k) => (ok.reduce((a, r) => a + (r[k] ?? 0), 0) / ok.length).toFixed(2);
  console.log('flat avg:', avg('t_fetchPost_s'), 's | raw avg:', avg('t_raw_s'), 's | video avg:', avg('t_video_s'), 's');
  console.log('fields avg:', avg('fields_ok'), '/', ok[0].fields_total, '| raw leaves avg:', avg('raw_leaf_count'));
}
