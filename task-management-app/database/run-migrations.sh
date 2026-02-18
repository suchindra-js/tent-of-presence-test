#!/bin/sh
# Usage: ./run-migrations.sh [connection_string]
# Example: DATABASE_URL=postgresql://app:secret@localhost:5432/taskdb ./run-migrations.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS_DIR="${SCRIPT_DIR}/migrations"
CONN="${1:-${DATABASE_URL}}"

if [ -z "$CONN" ]; then
  echo "Usage: $0 <connection_string>" >&2
  echo "  or set DATABASE_URL" >&2
  exit 1
fi

for f in $(ls "${MIGRATIONS_DIR}"/*.sql 2>/dev/null | sort); do
  echo "Running migration: $f"
  psql -v ON_ERROR_STOP=1 "$CONN" -f "$f"
done

echo "Migrations complete."
