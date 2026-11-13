#!/usr/bin/env bash
# v185 · Encrypted PostgreSQL backup. Reads the connection string and passphrase from the environment only
# (BACKUP_DATABASE_URL, BACKUP_PASSPHRASE) and never prints them. Writes OUT (default backup.dump.enc).
#   PG_DUMP / PG_RESTORE: commands to use (the workflow runs them from the postgres:18 image, matching Neon).
# Restore:  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in backup.dump.enc -out backup.dump
#           pg_restore --no-owner --no-privileges -d "$TARGET_DATABASE_URL" backup.dump
set -euo pipefail
: "${BACKUP_DATABASE_URL:?missing BACKUP_DATABASE_URL}"
: "${BACKUP_PASSPHRASE:?missing BACKUP_PASSPHRASE}"
OUT="${OUT:-backup.dump.enc}"
PG_DUMP="${PG_DUMP:-pg_dump}"
PG_RESTORE="${PG_RESTORE:-pg_restore}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
$PG_DUMP --format=custom --no-owner --no-privileges --dbname="$BACKUP_DATABASE_URL" > "$work/backup.dump"
# The dump must be readable before it is kept: a broken copy is worse than none, because it looks safe.
$PG_RESTORE --list < "$work/backup.dump" > "$work/contents.txt"
tables=$(grep -c " TABLE public " "$work/contents.txt" || true)
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -in "$work/backup.dump" -out "$OUT"
echo "backup ok: $(wc -c < "$work/backup.dump") bytes, $tables tables, encrypted to $OUT"
