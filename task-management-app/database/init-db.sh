#!/bin/sh
set -e
for f in $(ls /migrations/*.sql 2>/dev/null | sort); do
  echo "Running migration: $f"
  PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$f"
done
