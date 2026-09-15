#!/usr/bin/env bash
# PostToolUse(Edit|Write) on scripts/: the app never computes run statistics,
# so bake math and the committed artifacts drift apart silently.
set -uo pipefail

file=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
case "$file" in
  */scripts/*.ts) ;;
  *) exit 0 ;;
esac

jq -n '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: "Bake pipeline changed. Committed artifacts under public/resorts/ are now stale: cover the new behaviour in tests/, then re-bake (`npm run bake -- --all`) as part of this work."
  }
}'
