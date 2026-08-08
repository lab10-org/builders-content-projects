/** Workload real: traer los últimos N reels de una cuenta (North Star Account). */
import { igApi } from 'insta-fetcher';
import fs from 'node:fs';

const N = 12;
const ACCOUNTS = ['nasa', 'openai'];
const SESSIONID = (process.env.IG_SESSIONID ?? '').trim();
const ig = new igApi(SESSIONID ? `sessionid=${SESSIONID};` : undefined);
const sec = (t) => Number(((performance.now() - t) / 1000).toFixed(2));

const out = [];
for (const acc of ACCOUNTS) {
  const row = { account: acc };
  try {
    let t = performance.now();
    const reel = await ig.fetchUserReel(acc, null, N);
    row.t_total_s = sec(t);
    // shape real (2026): xdt_api__v1__clips__user__connection_v2.edges[].node.media
    const edges = reel?.xdt_api__v1__clips__user__connection_v2?.edges
      ?? reel?.items ?? reel?.data?.items ?? [];
    const media = edges.map(e => e?.node?.media ?? e?.media ?? e).filter(Boolean);
    row.reels = media.length;
    row.s_per_reel = Number((row.t_total_s / Math.max(media.length, 1)).toFixed(2));
    row.status = media.length ? 'ok' : 'empty';
    const m = media[0];
    row.sample = m ? {
      shortcode: m.code, likes: m.like_count, comments: m.comment_count,
      play_count: m.play_count ?? m.ig_play_count, duration: m.video_duration,
      caption_len: (m.caption?.text ?? '').length,
      music: m.clips_metadata?.music_info?.music_asset_info?.title ?? m.clips_metadata?.original_sound_info?.original_audio_title,
      video_url: !!m.video_versions?.[0]?.url,
    } : null;
  } catch (e) {
    row.status = 'error';
    row.error = `${e?.name}: ${String(e?.message).slice(0, 200)}`;
  }
  console.log(JSON.stringify(row));
  out.push(row);
}

fs.writeFileSync('results/profile_instafetcher.json',
  JSON.stringify({ tool: 'insta-fetcher', workload: `últimos ${N} reels por cuenta`, results: out }, null, 1));
