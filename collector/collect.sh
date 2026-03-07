#!/usr/bin/env bash
# collect.sh
# Script utama collector — scan semua repo, extract commit, tulis ke PostgreSQL

set -euo pipefail

# ============================================
# Load config dan environment
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env
if [[ -f "$PROJECT_DIR/.env" ]]; then
    export $(cat "$PROJECT_DIR/.env" | grep -v '^#' | xargs)
else
    echo "[ERROR] .env tidak ditemukan di $PROJECT_DIR"
    exit 1
fi

# Load config (list repo)
source "$SCRIPT_DIR/config.sh"

# Validasi DATABASE_URL
if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "[ERROR] DATABASE_URL tidak ditemukan di .env"
    exit 1
fi

# ============================================
# Helper functions
# ============================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Jalanin query SQL ke PostgreSQL
db_query() {
    psql "$DATABASE_URL" -t -c "$1" 2>/dev/null | xargs
}

# Jalanin query dan return hasil mentah (tanpa xargs)
db_query_raw() {
    psql "$DATABASE_URL" -t -c "$1" 2>/dev/null
}

# Escape single quote untuk SQL
escape_sql() {
    echo "${1//\'/\'\'}"
}

# ============================================
# Proses setiap repo
# ============================================

for REPO_PATH in "${REPOS[@]}"; do

    # Validasi folder repo ada
    if [[ ! -d "$REPO_PATH/.git" ]]; then
        log "[SKIP] Bukan git repo: $REPO_PATH"
        continue
    fi

    REPO_NAME=$(basename "$REPO_PATH")
    log "Processing repo: $REPO_NAME ($REPO_PATH)"

    # Fetch semua branch dari remote supaya data terbaru
    log "  Fetching all branches..."
    git -C "$REPO_PATH" fetch --all --quiet 2>/dev/null || true

    # Ambil remote URL
    REMOTE_URL=$(git -C "$REPO_PATH" remote get-url origin 2>/dev/null || echo "")
    REMOTE_URL=$(escape_sql "$REMOTE_URL")

    # ============================================
    # Insert repo ke database kalau belum ada
    # ============================================

    REPO_ID=$(db_query "
        SELECT id FROM repositories WHERE path = '$REPO_PATH' LIMIT 1;
    ")

    if [[ -z "$REPO_ID" ]]; then
        log "  Repo baru, insert ke database..."
        REPO_ID=$(db_query "
            INSERT INTO repositories (name, path, remote_url)
            VALUES ('$REPO_NAME', '$REPO_PATH', '$REMOTE_URL')
            RETURNING id;
        ")
        log "  Repo ID: $REPO_ID"
    else
        log "  Repo sudah ada, ID: $REPO_ID"
    fi

    # Ambil last_synced untuk incremental sync
    LAST_SYNCED=$(db_query "
        SELECT COALESCE(last_synced::text, '1970-01-01 00:00:00')
        FROM repositories
        WHERE id = $REPO_ID;
    ")

    log "  Last synced: $LAST_SYNCED"

    # ============================================
    # Ambil semua branch (lokal + remote)
    # ============================================

    BRANCHES=$(git -C "$REPO_PATH" branch -r --format='%(refname:short)' 2>/dev/null | \
        sed 's|origin/||' | \
        grep -v 'HEAD' | \
        grep -v '^origin$' | \
        sort -u)

    TOTAL_COMMITS_ADDED=0
    SYNC_STATUS="success"
    SYNC_ERROR=""

    # ============================================
    # Loop setiap branch
    # ============================================

    while IFS= read -r BRANCH; do
        [[ -z "$BRANCH" ]] && continue

        log "  Branch: $BRANCH"

        # Format git log — pakai | sebagai separator field
        # Format: SHA|author_name|author_email|timestamp|message
        GIT_LOG=$(git -C "$REPO_PATH" log \
            "origin/$BRANCH" \
            --format="%H|%aN|%aE|%at|%s" \
            --numstat \
            --after="$LAST_SYNCED" \
            2>/dev/null || \
        git -C "$REPO_PATH" log \
            "$BRANCH" \
            --format="%H|%aN|%aE|%at|%s" \
            --numstat \
            --after="$LAST_SYNCED" \
            2>/dev/null || echo "")

        [[ -z "$GIT_LOG" ]] && continue

        # Parse output git log
        CURRENT_SHA=""
        CURRENT_AUTHOR_NAME=""
        CURRENT_AUTHOR_EMAIL=""
        CURRENT_TS=""
        CURRENT_MSG=""
        LINES_ADDED=0
        LINES_REMOVED=0
        FILES_CHANGED=0

        flush_commit() {
            [[ -z "$CURRENT_SHA" ]] && return

            # Cek apakah SHA sudah ada di database (hindari duplikat)
            EXISTS=$(db_query "SELECT COUNT(*) FROM commits WHERE sha = '$CURRENT_SHA';")
            if [[ "$EXISTS" -gt 0 ]]; then
                return
            fi

            # Convert unix timestamp ke format PostgreSQL
            COMMITTED_AT=$(date -d "@$CURRENT_TS" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || \
                           date -r "$CURRENT_TS" '+%Y-%m-%d %H:%M:%S' 2>/dev/null)

            SAFE_MSG=$(escape_sql "$CURRENT_MSG")
            SAFE_AUTHOR=$(escape_sql "$CURRENT_AUTHOR_NAME")
            SAFE_EMAIL=$(escape_sql "$CURRENT_AUTHOR_EMAIL")
            SAFE_BRANCH=$(escape_sql "$BRANCH")

            db_query "
                INSERT INTO commits (
                    repo_id, sha, branch, author_name, author_email,
                    message, lines_added, lines_removed, files_changed, committed_at
                ) VALUES (
                    $REPO_ID,
                    '$CURRENT_SHA',
                    '$SAFE_BRANCH',
                    '$SAFE_AUTHOR',
                    '$SAFE_EMAIL',
                    '$SAFE_MSG',
                    $LINES_ADDED,
                    $LINES_REMOVED,
                    $FILES_CHANGED,
                    '$COMMITTED_AT'
                ) ON CONFLICT (sha) DO NOTHING;
            " > /dev/null

            TOTAL_COMMITS_ADDED=$((TOTAL_COMMITS_ADDED + 1))

            # Reset
            CURRENT_SHA=""
            LINES_ADDED=0
            LINES_REMOVED=0
            FILES_CHANGED=0
        }

        while IFS= read -r LINE; do
            [[ -z "$LINE" ]] && continue

            # Cek apakah ini header commit (ada 4 pipe separator)
            PIPE_COUNT=$(echo "$LINE" | tr -cd '|' | wc -c)

            if [[ $PIPE_COUNT -ge 4 ]]; then
                # Flush commit sebelumnya
                flush_commit

                # Parse header baru
                IFS='|' read -r CURRENT_SHA CURRENT_AUTHOR_NAME CURRENT_AUTHOR_EMAIL CURRENT_TS CURRENT_MSG <<< "$LINE"
            else
                # Ini numstat line: "added\tremoved\tfilepath"
                ADDED=$(echo "$LINE" | awk '{print $1}')
                REMOVED=$(echo "$LINE" | awk '{print $2}')

                # Skip binary files (ditandai dengan "-")
                if [[ "$ADDED" =~ ^[0-9]+$ ]]; then
                    LINES_ADDED=$((LINES_ADDED + ADDED))
                fi
                if [[ "$REMOVED" =~ ^[0-9]+$ ]]; then
                    LINES_REMOVED=$((LINES_REMOVED + REMOVED))
                fi
                FILES_CHANGED=$((FILES_CHANGED + 1))
            fi
        done <<< "$GIT_LOG"

        # Flush commit terakhir
        flush_commit

    done <<< "$BRANCHES"

    # ============================================
    # Update daily_summary
    # ============================================

    log "  Updating daily summary..."
    db_query "
        INSERT INTO daily_summary (repo_id, date, commit_count, lines_added, lines_removed, files_changed, active_hours, branches)
        SELECT
            repo_id,
            DATE(committed_at) as date,
            COUNT(*) as commit_count,
            SUM(lines_added) as lines_added,
            SUM(lines_removed) as lines_removed,
            SUM(files_changed) as files_changed,
            ARRAY_AGG(DISTINCT EXTRACT(HOUR FROM committed_at)::int ORDER BY EXTRACT(HOUR FROM committed_at)::int) as active_hours,
            ARRAY_AGG(DISTINCT branch) as branches
        FROM commits
        WHERE repo_id = $REPO_ID
        GROUP BY repo_id, DATE(committed_at)
        ON CONFLICT (repo_id, date) DO UPDATE SET
            commit_count  = EXCLUDED.commit_count,
            lines_added   = EXCLUDED.lines_added,
            lines_removed = EXCLUDED.lines_removed,
            files_changed = EXCLUDED.files_changed,
            active_hours  = EXCLUDED.active_hours,
            branches      = EXCLUDED.branches;
    " > /dev/null

    # ============================================
    # Update last_synced dan tulis sync_log
    # ============================================

    db_query "
        UPDATE repositories
        SET last_synced = NOW()
        WHERE id = $REPO_ID;
    " > /dev/null

    db_query "
        INSERT INTO sync_log (repo_id, commits_added, status)
        VALUES ($REPO_ID, $TOTAL_COMMITS_ADDED, '$SYNC_STATUS');
    " > /dev/null

    log "  Done. Commits added: $TOTAL_COMMITS_ADDED"

done

log "Collector selesai."
