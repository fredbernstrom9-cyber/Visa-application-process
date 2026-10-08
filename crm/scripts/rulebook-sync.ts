// npm run rulebook:sync [-- --dry-run]     validate and write to SUPABASE_DB_URL
// npm run rulebook:check                    validate only
//
// Validates the rulebook in ./rulebook and writes it to the database given by SUPABASE_DB_URL
// (Supabase dashboard → Connect → Session pooler connection string). Prints what changed.
// A rulebook that does not validate is never written.
import { Client } from 'pg';
import { buildRulebook } from '../rulebook';
import { syncRulebook } from '../rulebook/sync';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const checkOnly = process.argv.includes('--check');
  const url = checkOnly ? undefined : (process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL);
  const today = new Date().toISOString().slice(0, 10);
  const rb = buildRulebook(today);
  console.log(`Rulebook ${rb.version}: ${rb.guides.length} guides, ${rb.requirements.length} checklist rules, ${rb.facts.length} facts, ${rb.changes.length} changes, ${rb.sources.length} sources.`);
  if (!url) {
    console.log(checkOnly ? 'Valid.' : 'SUPABASE_DB_URL is not set: validated only, nothing written.');
    return;
  }
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    const r = await syncRulebook(db, rb, { today, dryRun });
    console.log(`${dryRun ? '[dry run] ' : ''}Synced ${r.version}.`);
    console.log(`  checklist rules: ${r.requirementsAdded.length} added, ${r.requirementsChanged.length} changed, ${r.requirementsRetired.length} retired`);
    for (const id of r.requirementsChanged) console.log(`    changed: ${id}`);
    console.log(`  facts changed: ${r.factsChanged}`);
    for (const c of r.changesPublished) console.log(`  change published: ${c.id}${c.notified ? ' (organisations notified)' : ' (history, no notification)'}`);
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
