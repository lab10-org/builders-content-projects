/** E2E real: últimos N reels de una cuenta CON métricas + caption + url de video. */
import { igApi } from 'insta-fetcher';
import fs from 'node:fs';

const N = 10;
const ACCOUNTS = ['nasa', 'openai'];
const PARALLEL = Number(process.env.PARALLEL ?? 1);
const ig = new igApi(`sessionid=${(process.env.IG_SESSIONID ?? '').trim()};`);
const sec = (t) => Number(((performance.now() - t) / 1000).toFixed(2));

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const out = [];
for (const acc of ACCOUNTS) {
  const row = { account: acc, parallel: PARALLEL };
  const t0 = performance.now();
  try {
    // paso 1: listado (métricas)
    let t = performance.now();
    const reel = await ig.fetchUserReel(acc, null, N);
    const media = (reel?.xdt_api__v1__clips__user__connection_v2?.edges ?? [])
      .map(e => e.node.media).slice(0, N);
    row.t_listing_s = sec(t);

    // paso 2: enriquecer cada reel (caption + video url)
    t = performance.now();
    const full = await mapLimit(media, PARALLEL, async (m) => {
      try {
        const raw = await ig.fetchPostByMediaId(m.pk);
        const it = raw?.items?.[0] ?? {};
        return {
          shortcode: m.code, likes: m.like_count, comments: m.comment_count,
          play_count: m.play_count, caption: it.caption?.text ?? null,
          duration: it.video_duration ?? null,
          video_url: it.video_versions?.[0]?.url ?? null,
          music: it.clips_metadata?.music_info?.music_asset_info?.title
              ?? it.clips_metadata?.original_sound_info?.original_audio_title ?? null,
        };
      } catch (e) { return { shortcode: m.code, error: String(e?.message).slice(0, 80) }; }
    });
    row.t_enrich_s = sec(t);
    row.t_total_s = sec(t0);
    row.reels = full.length;
    row.with_caption = full.filter(r => r.caption).length;
    row.with_video = full.filter(r => r.video_url).length;
    row.with_views = full.filter(r => r.play_count != null).length;
    row.with_music = full.filter(r => r.music).length;
    row.s_per_reel = Number((row.t_total_s / Math.max(full.length, 1)).toFixed(2));
    row.status = 'ok';
    row.sample = full[0];
  } catch (e) {
    row.status = 'error'; row.error = `${e?.name}: ${String(e?.message).slice(0, 200)}`;
    row.t_total_s = sec(t0);
  }
  console.log(JSON.stringify({ ...row, sample: undefined }));
  out.push(row);
}
fs.writeFileSync(`results/e2e_instafetcher_p${PARALLEL}.json`,
  JSON.stringify({ tool: 'insta-fetcher', parallel: PARALLEL, results: out }, null, 1));
