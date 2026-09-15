#!/usr/bin/env bash
# PostToolUse(Edit|Write): format the file Claude just wrote, so an agent's
# diffs are never what makes `npm run format:check` fail.
set -uo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
file=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
[ -n "$file" ] || exit 0

cd "$root" || exit 0
npx --no-install prettier --write --ignore-unknown "$file" >/dev/null 2>&1 || true
