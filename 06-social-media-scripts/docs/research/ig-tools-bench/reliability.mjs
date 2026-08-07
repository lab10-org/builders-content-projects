/** Fiabilidad: resolver perfil + primer reel en varias cuentas. */
import { igApi } from 'insta-fetcher';
import fs from 'node:fs';

const ACCOUNTS = ['nasa', 'openai', 'natgeo', 'nike', 'spotify', 'anthropicai', 'vercel', 'github'];
const ig = new igApi(`sessionid=${(process.env.IG_SESSIONID ?? '').trim()};`);
const sec = (t) => Number(((performance.now() - t) / 1000).toFixed(2));

const out = [];
for (const acc of ACCOUNTS) {
  const t0 = performance.now();
  let r;
  try {
    const reel = await ig.fetchUserReel(acc, null, 1);
    const m = reel?.xdt_api__v1__clips__user__connection_v2?.edges?.[0]?.node?.media;
    r = { account: acc, status: m ? 'ok' : 'empty', t_s: sec(t0), first_post: m?.code ?? null, play_count: m?.play_count ?? null };
  } catch (e) {
    r = { account: acc, status: 'error', t_s: sec(t0), error: e?.name, msg: String(e?.message).slice(0, 110) };
  }
  console.log(JSON.stringify(r));
  out.push(r);
  await new Promise(x => setTimeout(x, 1500));
}
const ok = out.filter(r => r.status === 'ok').length;
console.log(`\ninsta-fetcher fiabilidad: ${ok}/${out.length}`);
fs.writeFileSync('results/reliability_instafetcher.json', JSON.stringify({ tool: 'insta-fetcher', results: out }, null, 1));
