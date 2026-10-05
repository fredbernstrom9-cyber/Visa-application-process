#!/usr/bin/env bash
# Starts/stops a throwaway local PostgreSQL (no Docker) used by `npm run test:db`.
# Usage: bash scripts/pg-local.sh start|stop|status|url
# Env:   PGPORT (default 54329), PGDATA_DIR (default /var/tmp/clearentry-pg)
set -euo pipefail

PGPORT="${PGPORT:-54329}"
PGDATA_DIR="${PGDATA_DIR:-/var/tmp/clearentry-pg}"
PGBIN="${PGBIN:-}"
if [ -z "$PGBIN" ]; then
  PGBIN="$(dirname "$(ls /usr/lib/postgresql/*/bin/pg_ctl 2>/dev/null | sort -V | tail -1)")"
fi
[ -x "$PGBIN/pg_ctl" ] || { echo "PostgreSQL binaries not found (set PGBIN)" >&2; exit 1; }

# initdb/postgres refuse to run as root: drop to the postgres user when needed.
run() { if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi; }

url() { echo "postgresql://postgres@127.0.0.1:${PGPORT}/postgres"; }

case "${1:-}" in
  start)
    if [ ! -d "$PGDATA_DIR/base" ]; then
      mkdir -p "$PGDATA_DIR"
      [ "$(id -u)" = "0" ] && chown postgres:postgres "$PGDATA_DIR"
      run "$PGBIN/initdb" -D "$PGDATA_DIR" -U postgres --auth=trust >/dev/null
    fi
    if ! run "$PGBIN/pg_ctl" -D "$PGDATA_DIR" status >/dev/null 2>&1; then
      run "$PGBIN/pg_ctl" -D "$PGDATA_DIR" -o "-p ${PGPORT} -k /tmp -c listen_addresses=127.0.0.1 -c fsync=off -c synchronous_commit=off -c full_page_writes=off" -l "$PGDATA_DIR/server.log" -w start >/dev/null
    fi
    echo "$(url)"
    ;;
  stop)
    run "$PGBIN/pg_ctl" -D "$PGDATA_DIR" -m fast stop || true
    ;;
  status)
    run "$PGBIN/pg_ctl" -D "$PGDATA_DIR" status
    ;;
  url) url ;;
  *) echo "usage: $0 start|stop|status|url" >&2; exit 2 ;;
esac
