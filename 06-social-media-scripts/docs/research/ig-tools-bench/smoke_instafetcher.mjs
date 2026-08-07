import { igApi } from 'insta-fetcher';

const URL = 'https://www.instagram.com/reel/Dbn-XJhk0_-/';
const ig = new igApi(); // sin cookie: modo anónimo

const t0 = performance.now();
try {
  const res = await ig.fetchPost(URL);
  console.log('OK', ((performance.now() - t0) / 1000).toFixed(2), 's');
  console.log(JSON.stringify(res, null, 1).slice(0, 2500));
} catch (e) {
  console.log('FAIL', ((performance.now() - t0) / 1000).toFixed(2), 's');
  console.log(e?.constructor?.name, ':', String(e?.message ?? e).slice(0, 400));
  process.exit(1);
}
