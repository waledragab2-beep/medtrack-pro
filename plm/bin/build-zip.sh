#!/usr/bin/env bash
#
# Prima License Manager — deployment package builder.
#
# Produces a clean, upload-ready zip of the application, excluding runtime
# data, secrets and version-control metadata. The resulting archive can be
# uploaded directly to Hostinger (or any Apache/PHP 8.3/MySQL 8 host).
#
# Usage:
#   bash bin/build-zip.sh [output-name.zip]
#
# Run from anywhere; paths are resolved relative to the project root.

set -euo pipefail

# Resolve the project root (parent of this script's bin/ directory).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"          # .../plm
PARENT_DIR="$(dirname "$PROJECT_DIR")"          # repo root containing plm/
PROJECT_NAME="$(basename "$PROJECT_DIR")"       # plm

# Read version from config for a sensible default filename.
VERSION="$(grep -oE "'version'\s*=>\s*'[^']+'" "$PROJECT_DIR/config/config.php" | head -1 | grep -oE "[0-9]+\.[0-9]+\.[0-9]+" || echo "1.0.0")"
OUTPUT="${1:-prima-license-manager-v${VERSION}.zip}"

if ! command -v zip >/dev/null 2>&1; then
    echo "Error: 'zip' is not installed." >&2
    exit 1
fi

cd "$PARENT_DIR"
rm -f "$OUTPUT"

echo "Building deployment package: $OUTPUT"

zip -rq "$OUTPUT" "$PROJECT_NAME" \
    -x "$PROJECT_NAME/.git/*" \
    -x "*/.DS_Store" \
    -x "$PROJECT_NAME/storage/logs/*.log" \
    -x "$PROJECT_NAME/storage/backups/*.sql" \
    -x "$PROJECT_NAME/storage/backups/*.zip" \
    -x "$PROJECT_NAME/storage/keys/*" \
    -x "$PROJECT_NAME/storage/installed.lock" \
    -x "$PROJECT_NAME/config/database.local.php" \
    -x "$PROJECT_NAME/vendor/*"

# Sanity check: ensure no secrets slipped in.
if unzip -l "$OUTPUT" | grep -qE "storage/keys/|installed.lock|config/database.local.php$"; then
    echo "Error: package unexpectedly contains secrets — aborting." >&2
    rm -f "$OUTPUT"
    exit 1
fi

COUNT="$(unzip -l "$OUTPUT" | tail -1 | awk '{print $2}')"
SIZE="$(du -h "$OUTPUT" | cut -f1)"

echo "Done: $OUTPUT  (${COUNT} files, ${SIZE})"
echo "Writable dirs preserved:"
unzip -l "$OUTPUT" | grep -E "storage/(logs|uploads|temp|backups)/.gitkeep" | awk '{print "  " $4}'
