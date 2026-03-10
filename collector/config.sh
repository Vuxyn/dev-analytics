#!/usr/bin/env bash

REPOS_BASE_DIR="${REPOS_BASE_DIR:-/home/vuxyn/projects}"

# Auto-detect semua git repo di base dir (depth 1)
REPOS=()
while IFS= read -r -d '' dir; do
    REPOS+=("$(dirname "$dir")")
done < <(find "$REPOS_BASE_DIR" -maxdepth 2 -name ".git" -print0)
