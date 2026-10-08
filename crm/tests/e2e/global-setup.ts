import { execSync } from 'node:child_process';

// Starts (or reuses) the local Supabase-compatible stack. Idempotent.
export default function globalSetup() {
  execSync('bash scripts/dev-stack/stack.sh start', { stdio: 'inherit' });
}
