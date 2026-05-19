#!/usr/bin/env bash
set -euo pipefail

# restore.sh — restore a mongodump. Usage:
#   ./restore.sh /full/path/to/dump-dir
# If no arg provided, restores the latest dump in ../backups
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/../.env"

if [ -f "$ENV_FILE" ]; then
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
fi

: "${MONGO_URI:?MONGO_URI is not set in environment or .env}"
: "${DB_NAME:?DB_NAME is not set in environment or .env}"

if [ $# -ge 1 ]; then
  DUMP_DIR="$1"
else
  # pick latest dump directory
  DUMP_DIR="$(ls -1dt "$ROOT_DIR"/backups/dump-* 2>/dev/null | head -n1)"
  if [ -z "$DUMP_DIR" ]; then
    echo "No dump directories found in $ROOT_DIR/backups"
    exit 1
  fi
fi

# If the dump directory contains the DB as a subdirectory (mongodump default), point to it
if [ -d "$DUMP_DIR/$DB_NAME" ]; then
  TARGET_DIR="$DUMP_DIR/$DB_NAME"
else
  TARGET_DIR="$DUMP_DIR"
fi

echo "Restoring database '$DB_NAME' from '$TARGET_DIR' (this will drop existing data)..."
mongorestore --uri "$MONGO_URI" --drop "$TARGET_DIR"

echo "Restore complete."
exit 0
