#!/usr/bin/env bash
# Local Supabase-compatible stack without Docker: PostgreSQL + PostgREST + a small auth/storage gateway.
# Used for `npm run stack:start` (try the app locally) and for the Playwright end-to-end tests.
#
#   bash scripts/dev-stack/stack.sh start [--reset]   start (or reset the database and start)
#   bash scripts/dev-stack/stack.sh stop
#   bash scripts/dev-stack/stack.sh env               print the .env.local values for the app
set -euo pipefail
cd "$(dirname "$0")/../.."

PGPORT="${PGPORT:-54329}"
REST_PORT="${REST_PORT:-54322}"
GATEWAY_PORT="${GATEWAY_PORT:-54321}"
DB_NAME="${STACK_DB_NAME:-clearentry_dev}"
JWT_SECRET="${JWT_SECRET:-super-secret-jwt-token-with-at-least-32-characters-long}"
POSTGREST_VERSION="${POSTGREST_VERSION:-v12.2.12}"
STACK_DIR=".stack"
BIN="$STACK_DIR/bin/postgrest"
SUPER_URL="postgresql://postgres@127.0.0.1:${PGPORT}"

mkdir -p "$STACK_DIR/bin"

ensure_postgrest() {
  [ -x "$BIN" ] && return
  echo "Downloading PostgREST ${POSTGREST_VERSION}..."
  curl -fsSL "https://github.com/PostgREST/postgrest/releases/download/${POSTGREST_VERSION}/postgrest-${POSTGREST_VERSION}-linux-static-x86-64.tar.xz" -o "$STACK_DIR/pgrst.tar.xz"
  tar -xJf "$STACK_DIR/pgrst.tar.xz" -C "$STACK_DIR/bin" && rm "$STACK_DIR/pgrst.tar.xz"
}

stop_pid() {
  [ -f "$1" ] || return 0
  local pid; pid="$(cat "$1")"
  kill "$pid" 2>/dev/null || true
  for _ in $(seq 1 40); do kill -0 "$pid" 2>/dev/null || break; sleep 0.1; done
  kill -9 "$pid" 2>/dev/null || true
  rm -f "$1"
}

healthy() {
  curl -fsS "http://127.0.0.1:${GATEWAY_PORT}/__health" >/dev/null 2>&1 && curl -fsS -o /dev/null "http://127.0.0.1:${REST_PORT}/" -H "apikey: x" 2>/dev/null
}

migrate() {
  psql "$SUPER_URL/postgres" -qAt -c "select 1 from pg_database where datname='${DB_NAME}'" | grep -q 1 \
    || psql "$SUPER_URL/postgres" -q -c "create database ${DB_NAME}"
  local ready
  ready="$(psql "$SUPER_URL/${DB_NAME}" -qAt -c "select to_regclass('public.cases') is not null")"
  if [ "$ready" != "t" ]; then
    echo "Applying Supabase shim and migrations..."
    psql "$SUPER_URL/${DB_NAME}" -q -v ON_ERROR_STOP=1 -f tests/db/supabase-shim.sql 2>&1 | grep -v "wal_level\|HINT" || true
    for f in supabase/migrations/*.sql; do psql "$SUPER_URL/${DB_NAME}" -q -v ON_ERROR_STOP=1 -f "$f"; done
  fi
  psql "$SUPER_URL/${DB_NAME}" -q <<SQL
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if;
end \$\$;
grant anon, authenticated, service_role to authenticator;
SQL
}

start() {
  bash scripts/pg-local.sh start >/dev/null
  # The dev database is disposable: rebuild it automatically when migrations or the shim changed.
  local sig; sig="$(cat tests/db/supabase-shim.sql supabase/migrations/*.sql | sha256sum | cut -d' ' -f1)"
  if [ -f "$STACK_DIR/migrations.sha" ] && [ "$(cat "$STACK_DIR/migrations.sha")" != "$sig" ]; then
    echo "Migrations changed: resetting the dev database."
    set -- "--reset"
  fi
  echo "$sig" > "$STACK_DIR/migrations.sha"
  if [ "${1:-}" != "--reset" ] && healthy; then echo "Stack already running: http://127.0.0.1:${GATEWAY_PORT}"; return; fi
  if [ "${1:-}" = "--reset" ]; then
    stop_services
    psql "$SUPER_URL/postgres" -q -c "drop database if exists ${DB_NAME} with (force)"
    rm -rf "$STACK_DIR/storage"
  fi
  ensure_postgrest
  migrate
  stop_services

  cat > "$STACK_DIR/postgrest.conf" <<CONF
db-uri = "postgres://authenticator@127.0.0.1:${PGPORT}/${DB_NAME}"
db-schemas = "public"
db-anon-role = "anon"
db-max-rows = 1000
jwt-secret = "${JWT_SECRET}"
server-host = "127.0.0.1"
server-port = ${REST_PORT}
CONF
  nohup "$BIN" "$STACK_DIR/postgrest.conf" > "$STACK_DIR/postgrest.log" 2>&1 &
  echo $! > "$STACK_DIR/postgrest.pid"

  STACK_DB_URL="$SUPER_URL/${DB_NAME}" GATEWAY_PORT="$GATEWAY_PORT" POSTGREST_URL="http://127.0.0.1:${REST_PORT}" JWT_SECRET="$JWT_SECRET" \
    nohup node scripts/dev-stack/gateway.mjs > "$STACK_DIR/gateway.log" 2>&1 &
  echo $! > "$STACK_DIR/gateway.pid"

  for _ in $(seq 1 60); do
    if healthy; then
      echo "Stack ready: http://127.0.0.1:${GATEWAY_PORT}"
      return
    fi
    sleep 0.5
  done
  echo "Stack failed to start. See $STACK_DIR/*.log" >&2
  tail -n 20 "$STACK_DIR/postgrest.log" >&2 || true; tail -n 20 "$STACK_DIR/gateway.log" >&2 || true
  exit 1
}

stop_services() { stop_pid "$STACK_DIR/gateway.pid"; stop_pid "$STACK_DIR/postgrest.pid"; }

case "${1:-}" in
  start) start "${2:-}" ;;
  stop) stop_services ;;
  env)
    node -e "const k=require('./.stack/keys.json');console.log('NEXT_PUBLIC_SUPABASE_URL='+k.url+'\nNEXT_PUBLIC_SUPABASE_ANON_KEY='+k.anon+'\nSUPABASE_SERVICE_ROLE_KEY='+k.service+'\nNEXT_PUBLIC_APP_URL=http://localhost:3000')"
    ;;
  *) echo "usage: $0 start [--reset] | stop | env" >&2; exit 2 ;;
esac
