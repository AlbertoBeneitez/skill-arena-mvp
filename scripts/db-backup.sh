#!/usr/bin/env bash
# v186 · Encrypted PostgreSQL backup with age (public-key encryption with integrity check).
#   BACKUP_DATABASE_URL  connection string (environment only; never printed)
#   RECIPIENTS           file with the owner's age public key(s), default ops/backup-recipient.txt
#   OUT                  output file, default backup.dump.age
# Anyone can encrypt with the public key; only the owner's private key (kept offline) can open a copy:
#   age -d -i galactic-backup-key.txt -o backup.dump backup.dump.age
#   pg_restore --no-owner --no-privileges -d "$TARGET_DATABASE_URL" backup.dump
set -euo pipefail
: "${BACKUP_DATABASE_URL:?missing BACKUP_DATABASE_URL}"
RECIPIENTS="${RECIPIENTS:-ops/backup-recipient.txt}"
OUT="${OUT:-backup.dump.age}"
if ! grep -q '^age1' "$RECIPIENTS"; then
  echo "no age public key in $RECIPIENTS" >&2
  exit 2
fi
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
pg_dump --format=custom --no-owner --no-privileges --dbname="$BACKUP_DATABASE_URL" > "$work/backup.dump"
# The dump must be readable before it is kept: a broken copy is worse than none, because it looks safe.
pg_restore --list "$work/backup.dump" > "$work/contents.txt"
tables=$(grep -c " TABLE public " "$work/contents.txt" || true)
age -R "$RECIPIENTS" -o "$OUT" "$work/backup.dump"
echo "backup ok: $(wc -c < "$work/backup.dump") bytes, $tables tables, encrypted to $OUT"
