#!/usr/bin/env bash
# Runs the database / RLS tests. Uses TEST_DATABASE_URL (a superuser connection to any
# Postgres 15+ server) when set; otherwise starts a throwaway local cluster.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${TEST_DATABASE_URL:-}" ]; then
  TEST_DATABASE_URL="$(bash scripts/pg-local.sh start)"
  export TEST_DATABASE_URL
fi
exec npx vitest run --project db "$@"
