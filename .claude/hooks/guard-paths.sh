#!/usr/bin/env bash
# PreToolUse(Edit|Write): two paths an implementation session must not edit
# by hand — baked output (SPEC §12) and the hard rules themselves (SPEC §8).
set -uo pipefail

file=$(jq -r '.tool_input.file_path // empty')
[ -n "$file" ] || exit 0

deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

ask() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

case "$file" in
  */public/resorts/*)
    deny "public/resorts/ is baked output, not source (SPEC §12). Change scripts/ and re-run \`npm run bake -- --resort <slug>\`."
    ;;
  */SPEC.md)
    ask "SPEC.md carries the §8 hard rules. Changing them changes the project's risk profile and is not an implementation-session decision."
    ;;
esac

exit 0
