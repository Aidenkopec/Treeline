#!/usr/bin/env bash
# Stop: numerical work gets automated verification (AGENTS.md), so a turn that
# touched TypeScript ends with typecheck and tests green rather than assumed so.
set -uo pipefail

[ "$(jq -r '.stop_hook_active // false')" = "true" ] && exit 0

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root" || exit 0

[ -n "$(git status --porcelain -- '*.ts' '*.tsx' '*.mts' 2>/dev/null)" ] || exit 0

if ! output=$( { npm run typecheck && npm test; } 2>&1 ); then
  jq -n --arg out "$output" '{
    decision: "block",
    reason: ("Typecheck or tests failed on the changed TypeScript. Fix before handing this over:\n\n" + $out)
  }'
fi

exit 0
