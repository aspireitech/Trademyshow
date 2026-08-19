#!/usr/bin/env bash
# Back up the SQLite database and verify the copy is actually restorable.
#
# An untested backup is not a backup — this script refuses to keep a dump it
# cannot open and query, which is the failure mode people discover too late.
set -euo pipefail

DB_PATH="${DB_PATH:-./data/trademyshow.db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETAIN_DAYS="${RETAIN_DAYS:-30}"

[ -f "$DB_PATH" ] || { echo "no database at $DB_PATH" >&2; exit 1; }
mkdir -p "$BACKUP_DIR"

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TARGET="$BACKUP_DIR/trademyshow-$STAMP.db"

# .backup is safe on a live database; copying the file is not.
sqlite3 "$DB_PATH" ".backup '$TARGET'"

# Restore drill: integrity check plus a real query.
if ! sqlite3 "$TARGET" "PRAGMA integrity_check;" | grep -q '^ok$'; then
  echo "integrity check FAILED for $TARGET" >&2
  rm -f "$TARGET"
  exit 1
fi
USERS=$(sqlite3 "$TARGET" "SELECT COUNT(*) FROM users;")

gzip -f "$TARGET"
echo "backup ok: $TARGET.gz ($USERS users)"

find "$BACKUP_DIR" -name 'trademyshow-*.db.gz' -mtime "+$RETAIN_DAYS" -delete
echo "pruned backups older than $RETAIN_DAYS days"
