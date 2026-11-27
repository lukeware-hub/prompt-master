#!/usr/bin/env bash
# Prepares (and later removes) the folder that PublishPlugin uploads to the organization library on claude.ai.
#
# Claude Desktop loads the remote copy of the plugin ("exists in both remote and local. Using remote."),
# so every installed release must also be published there.
#
#   scripts/publish-org.sh prepare   copies the committed files to a temporary folder and prints its path
#   scripts/publish-org.sh clean     removes that folder
#
# Between the two, call the PublishPlugin tool on the printed path with destination "organization"
# (replace: true when an older copy is already in the uploads). PublishPlugin refuses the project folder
# and the plugin cache folder, and the folder must go away afterwards: the hot-reload of
# ~/.claude/dev-mods would otherwise load it as a second Prompt Master.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target="${PROMPT_MASTER_PUBLISH_DIR:-$HOME/.claude/dev-mods/publish/prompt-master}"

case "${1:-}" in
  prepare)
    rm -rf "$target"
    mkdir -p "$target"
    git -C "$root" archive HEAD | tar -x -C "$target"
    rm -f "$target/.claude-plugin/marketplace.json"
    rm -rf "$target/scripts"
    echo "$target"
    ;;
  clean)
    rm -rf "$target"
    rmdir "$(dirname "$target")" 2>/dev/null || true
    echo "removed $target"
    ;;
  *)
    echo "usage: $0 prepare|clean" >&2
    exit 2
    ;;
esac
