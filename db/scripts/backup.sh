#!/usr/bin/env bash
set -euo pipefail

# backup.sh — create a mongodump into ../backups/dump-<timestamp>
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/../.env"

if [ -f "$ENV_FILE" ]; then
  # Load env variables (exported)
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
fi

: "${MONGO_URI:?MONGO_URI is not set in environment or .env}"
: "${DB_NAME:?DB_NAME is not set in environment or .env}"

TIMESTAMP="$(date +%F_%H%M%S)"
OUTDIR="$ROOT_DIR/backups/dump-$TIMESTAMP"
mkdir -p "$OUTDIR"

echo "Backing up database '$DB_NAME' to '$OUTDIR'..."
mongodump --uri "$MONGO_URI" --db "$DB_NAME" --out "$OUTDIR"

echo "Backup complete: $OUTDIR"
exit 0
