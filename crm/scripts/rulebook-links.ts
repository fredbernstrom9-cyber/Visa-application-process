// npm run rulebook:links
//
// Checks that every source and guide link in the rulebook still answers. Run it before each
// re-verification round; a broken link usually means the authority moved or rewrote the page,
// which is exactly when the rule behind it needs re-checking. Prints only problems.
import { buildRulebook } from '../rulebook';

const CONCURRENCY = 8;
const TIMEOUT_MS = 20_000;

async function check(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'ClearEntry rulebook link check' } });
    if (res.status === 405 || res.status === 403) res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'ClearEntry rulebook link check' } });
    return res.ok ? null : `HTTP ${res.status}`;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const rb = buildRulebook();
  const urls = new Map<string, string[]>();
  for (const s of rb.sources) urls.set(s.url, [...(urls.get(s.url) ?? []), `source ${s.id}`]);
  for (const g of rb.guides) for (const l of g.links) urls.set(l.url, [...(urls.get(l.url) ?? []), `guide ${g.id}`]);
  const list = [...urls.keys()];
  let bad = 0;
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const batch = list.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(check));
    results.forEach((r, j) => {
      if (r) { bad++; console.log(`${r.padEnd(12)} ${batch[j]}  (${urls.get(batch[j])!.slice(0, 3).join(', ')})`); }
    });
  }
  console.log(`${list.length} links checked, ${bad} problem(s).`);
  if (bad) process.exitCode = 1;
}

void main();
