#!/usr/bin/env bash
# collect.sh (SaaS JSON Version)
# Script ini mengumpulkan data Git secara lokal dan mengirimnya ke Vercel via JSON

set -uo pipefail

if ! command -v jq &> /dev/null; then
    echo "Error: jq is required to parse JSON. Please install jq."
    exit 1
fi

if ! command -v curl &> /dev/null; then
    echo "Error: curl is required to send data. Please install curl."
    exit 1
fi

# ============================================
# Load config and environment
# ============================================
CONFIG_FILE="$HOME/.dev-analytics/config.env"

if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
else
    echo "[ERROR] $CONFIG_FILE tidak ditemukan. Harap jalankan install.sh terlebih dahulu."
    exit 1
fi

if [[ -z "${DEV_USERNAME:-}" || -z "${DEV_PIN:-}" || -z "${API_URL:-}" || -z "${TARGET_DIR:-}" ]]; then
    echo "[ERROR] Invalid config. Missing DEV_USERNAME, DEV_PIN, API_URL or TARGET_DIR."
    exit 1
fi

# Sync all git history by default (safe - backend ignores duplicates via ON CONFLICT DO NOTHING)
SYNC_DAYS="${SYNC_DAYS:-all}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# ============================================
# Construct the Main JSON Payload Structure
# ============================================
PAYLOAD_FILE=$(mktemp /tmp/dev-analytics-payload-XXXXXX.json)
trap "rm -f $PAYLOAD_FILE" EXIT

# Start JSON Base
jq -n \
  --arg username "$DEV_USERNAME" \
  '{ "username": $username, "repositories": [] }' > "$PAYLOAD_FILE"


# Find all local repos under TARGET_DIR
mapfile -t REPO_PATHS < <(find "$TARGET_DIR" -type d -name ".git" | sed 's|/\.git||')

if [ ${#REPO_PATHS[@]} -eq 0 ]; then
    log "Tidak ada repositori ditemukan di $TARGET_DIR"
    exit 0
fi

TOTAL_COMMITS_ALL=0

for REPO_PATH in "${REPO_PATHS[@]}"; do
    REPO_NAME=$(basename "$REPO_PATH")
    log "Processing repo: $REPO_NAME ($REPO_PATH)"

    REMOTE_URL=$(git -C "$REPO_PATH" remote get-url origin 2>/dev/null || echo "")

    BRANCHES=$(git -C "$REPO_PATH" branch -r --format='%(refname:short)' 2>/dev/null | \
        sed 's|origin/||' | \
        grep -v 'HEAD' | \
        grep -v '^origin$' | \
        sort -u)

    if [[ -z "$BRANCHES" ]]; then
        BRANCHES=$(git -C "$REPO_PATH" branch --format='%(refname:short)' 2>/dev/null | sort -u)
        if [[ -z "$BRANCHES" ]]; then
            log "  Tidak ada branch ditemukan, skip"
            continue
        fi
    fi

    # Create temporary array for all commits in this repo
    REPO_COMMITS_FILE=$(mktemp /tmp/dev-analytics-commits-XXXXXX.json)
    echo "[]" > "$REPO_COMMITS_FILE"

    for BRANCH in $BRANCHES; do
        log "  Branch: $BRANCH"

        # Note: --after filter is simplified here. In production, we'd persist the LAST_SYNCED time per repo locally.
        # For this prototype we will sync all commits from the last 30 days to save bandwidth.
        if [[ "$SYNC_DAYS" == "all" ]]; then
            GIT_LOG=$(git -C "$REPO_PATH" log \
                "$BRANCH" \
                --format="%H|%aN|%aE|%at|%s" \
                --numstat \
                2>/dev/null || echo "")
        else
            GIT_LOG=$(git -C "$REPO_PATH" log \
                "$BRANCH" \
                --format="%H|%aN|%aE|%at|%s" \
                --numstat \
                --since="${SYNC_DAYS} days ago" \
                2>/dev/null || echo "")
        fi

        [[ -z "$GIT_LOG" ]] && continue

        log "    Parsing commits..."

        CURRENT_SHA=""
        CURRENT_AUTHOR_NAME=""
        CURRENT_AUTHOR_EMAIL=""
        CURRENT_TS=""
        CURRENT_MSG=""
        LINES_ADDED=0
        LINES_REMOVED=0
        FILES_CHANGED=0
        BRANCH_COMMIT_COUNT=0

        write_commit_to_json() {
            [[ -z "$CURRENT_SHA" ]] && return
            [[ ! "$CURRENT_TS" =~ ^[0-9]+$ ]] && return

            COMMITTED_AT=$(date -u -d "@$CURRENT_TS" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null)
            [[ -z "$COMMITTED_AT" ]] && return

            # Append the single commit into the repo's commit array
            # We use jq to handle string escaping correctly
            jq --arg hash "$CURRENT_SHA" \
               --arg branch "$BRANCH" \
               --arg author "$CURRENT_AUTHOR_NAME" \
               --arg email "$CURRENT_AUTHOR_EMAIL" \
               --arg date "$COMMITTED_AT" \
               --arg msg "$CURRENT_MSG" \
               --argjson add "$LINES_ADDED" \
               --argjson rem "$LINES_REMOVED" \
               --argjson files "$FILES_CHANGED" \
               '. += [{ "hash": $hash, "branch": $branch, "author": $author, "email": $email, "date": $date, "message": $msg, "insertions": $add, "deletions": $rem, "files": $files }]' \
               "$REPO_COMMITS_FILE" > "$REPO_COMMITS_FILE.tmp" && mv "$REPO_COMMITS_FILE.tmp" "$REPO_COMMITS_FILE"

            BRANCH_COMMIT_COUNT=$((BRANCH_COMMIT_COUNT + 1))
        }

        while IFS= read -r LINE; do
            [[ -z "$LINE" ]] && continue

            ONLY_PIPES="${LINE//[^|]/}"
            PIPE_COUNT="${#ONLY_PIPES}"

            if [[ $PIPE_COUNT -ge 4 ]]; then
                write_commit_to_json
                IFS='|' read -r CURRENT_SHA CURRENT_AUTHOR_NAME CURRENT_AUTHOR_EMAIL CURRENT_TS CURRENT_MSG <<< "$LINE"
                LINES_ADDED=0
                LINES_REMOVED=0
                FILES_CHANGED=0
            else
                IFS=$' \t' read -r ADDED REMOVED FILE_PATH <<< "$LINE"
                if [[ "$ADDED" =~ ^[0-9]+$ ]]; then LINES_ADDED=$((LINES_ADDED + ADDED)); fi
                if [[ "$REMOVED" =~ ^[0-9]+$ ]]; then LINES_REMOVED=$((LINES_REMOVED + REMOVED)); fi
                FILES_CHANGED=$((FILES_CHANGED + 1))
            fi
        done <<< "$GIT_LOG"

        # Flush commit terakhir
        write_commit_to_json

        log "    $BRANCH_COMMIT_COUNT commits diparsing"
        TOTAL_COMMITS_ALL=$((TOTAL_COMMITS_ALL + BRANCH_COMMIT_COUNT))

    done

    # Attach Repo JSON to the Main Payload Payload
    # If the repo has no commits in the last 30 days, we'll still send it to update its presence
    jq --arg name "$REPO_NAME" \
       --arg path "$REPO_PATH" \
       --arg remote "$REMOTE_URL" \
       --slurpfile commits "$REPO_COMMITS_FILE" \
       '.repositories += [{ "name": $name, "path": $path, "remote": $remote, "commits": $commits[0] }]' \
       "$PAYLOAD_FILE" > "$PAYLOAD_FILE.tmp" && mv "$PAYLOAD_FILE.tmp" "$PAYLOAD_FILE"

    rm -f "$REPO_COMMITS_FILE"

done

log "Sending $TOTAL_COMMITS_ALL commits to API at $API_URL..."

# ============================================
# Send the HTTP POST JSON
# ============================================

CURL_OUTPUT=$(mktemp)
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$CURL_OUTPUT" -X POST "$API_URL" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $DEV_PIN" \
     -d @"$PAYLOAD_FILE")

log "Server Response Code: $HTTP_CODE"
if [[ "$HTTP_CODE" == "200" ]]; then
    log "Data berhasil terkirim!"
    cat "$CURL_OUTPUT" | jq .
else
    log "[ERROR] Gagal mengirim data."
    cat "$CURL_OUTPUT"
fi

rm -f "$CURL_OUTPUT"
log "Selesai."
