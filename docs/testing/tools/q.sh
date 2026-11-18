# usage: bash q.sh "<SQL>"   read-only query on the field-test schema (transactions forced read-only)
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
export PGPASSWORD="$(grep '^DB_PASSWORD=' "$ROOT/backend/.env" | cut -d= -f2- | tr -d '\r')"
export PGOPTIONS="-c search_path=fieldtest_20261117 -c default_transaction_read_only=on"
"/c/Program Files/PostgreSQL/17/bin/psql.exe" -h localhost -U mzazicare -d mzazicare -P pager=off -c "$1" $2
