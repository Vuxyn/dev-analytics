#!/usr/bin/env bash
# collect.sh
# Script utama collector — scan semua repo, extract commit, tulis ke PostgreSQL
# Versi 2: batch insert untuk performa lebih cepat

set -uo pipefail

# ============================================
# Load config dan environment
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [[ -f "$PROJECT_DIR/.env" ]]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
else
    echo "[ERROR] .env tidak ditemukan di $PROJECT_DIR"
    exit 1
fi

source "$SCRIPT_DIR/config.sh"

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

db_query() {
    psql "$DATABASE_URL" -t -A -c "$1" 2>&1 | head -1 | xargs
}

db_exec() {
    psql "$DATABASE_URL" -t -A -c "$1"
}

db_exec_file() {
    psql "$DATABASE_URL" -t -A -f "$1"
}

escape_sql() {
    echo "${1//\'/\'\'}"
}

to_git_date() {
    local ts="$1"
    if [[ -z "$ts" || "$ts" == "1970-01-01 00:00:00" ]]; then
        echo "1970-01-01"
        return
    fi
    date -d "$ts" '+%Y-%m-%d' 2>/dev/null || echo "1970-01-01"
}

get_language() {
    local filename="$1"
    local ext="${filename##*.}"
    # Jika tidak ada titik, atau diawali titik tanpa ekstensi lain (misal .gitignore)
    if [[ "$filename" == "$ext" ]]; then
        case "$(basename "$filename")" in
            Dockerfile) echo "Dockerfile" ;;
            Makefile) echo "Makefile" ;;
            *) echo "Other" ;;
        esac
        return
    fi

    case "${ext,,}" in
        ts|tsx) echo "TypeScript" ;;
        js|jsx) echo "JavaScript" ;;
        py) echo "Python" ;;
        go) echo "Go" ;;
        sh) echo "Shell" ;;
        rb) echo "Ruby" ;;
        php) echo "PHP" ;;
        rs) echo "Rust" ;;
        c) echo "C" ;;
        cpp|cc|cxx) echo "C++" ;;
        cs) echo "C#" ;;
        java) echo "Java" ;;
        kt|kts) echo "Kotlin" ;;
        swift) echo "Swift" ;;
        md|markdown) echo "Markdown" ;;
        html|htm) echo "HTML" ;;
        css) echo "CSS" ;;
        scss|sass) echo "Sass" ;;
        sql) echo "SQL" ;;
        json) echo "JSON" ;;
        yml|yaml) echo "YAML" ;;
        *) echo "Other" ;;
    esac
}

# ============================================
# Proses setiap repo
# ============================================

for REPO_PATH in "${REPOS[@]}"; do

    if [[ ! -d "$REPO_PATH/.git" ]]; then
        log "[SKIP] Bukan git repo: $REPO_PATH"
        continue
    fi

    REPO_NAME=$(basename "$REPO_PATH")
    log "Processing repo: $REPO_NAME ($REPO_PATH)"

    # Associative array untuk language stats: "DATE|LANG|type" -> value
    # Kita reset per repo
    unset REPO_LANG_STATS
    declare -A REPO_LANG_STATS

    log "  Fetching all branches..."
    git -C "$REPO_PATH" fetch --all --quiet 2>/dev/null || true

    REMOTE_URL=$(git -C "$REPO_PATH" remote get-url origin 2>/dev/null || echo "")
    REMOTE_URL=$(escape_sql "$REMOTE_URL")

    # Insert repo kalau belum ada
    REPO_ID=$(db_query "SELECT id FROM repositories WHERE path = '$REPO_PATH' LIMIT 1;")

    if [[ -z "$REPO_ID" ]]; then
        log "  Repo baru, insert ke database..."
        REPO_ID=$(psql "$DATABASE_URL" -t -A -c "
            INSERT INTO repositories (name, path, remote_url)
            VALUES ('$REPO_NAME', '$REPO_PATH', '$REMOTE_URL')
            RETURNING id;
        " 2>/dev/null | grep -E '^[0-9]+$' | head -1)
        log "  Repo ID: $REPO_ID"
    else
        log "  Repo sudah ada, ID: $REPO_ID"
    fi

    if [[ ! "$REPO_ID" =~ ^[0-9]+$ ]]; then
        log "  [ERROR] REPO_ID tidak valid: '$REPO_ID', skip"
        continue
    fi

    LAST_SYNCED_RAW=$(db_query "
        SELECT COALESCE(last_synced::text, '1970-01-01 00:00:00')
        FROM repositories WHERE id = $REPO_ID;
    ")
    LAST_SYNCED=$(to_git_date "$LAST_SYNCED_RAW")
    log "  Last synced: $LAST_SYNCED"

    # Ambil semua branch remote
    BRANCHES=$(git -C "$REPO_PATH" branch -r --format='%(refname:short)' 2>/dev/null | \
        sed 's|origin/||' | \
        grep -v 'HEAD' | \
        grep -v '^origin$' | \
        sort -u)

    if [[ -z "$BRANCHES" ]]; then
        log "  Tidak ada branch ditemukan, skip"
        continue
    fi

    TOTAL_COMMITS_ADDED=0
    SYNC_STATUS="success"

    # Tempfile untuk batch SQL
    BATCH_SQL=$(mktemp /tmp/dev-analytics-batch-XXXXXX.sql)
    trap "rm -f $BATCH_SQL" EXIT

    # ============================================
    # Loop setiap branch — kumpulkan semua values
    # ============================================

    while IFS= read -r BRANCH; do
        [[ -z "$BRANCH" ]] && continue

        log "  Branch: $BRANCH"

        GIT_LOG=$(git -C "$REPO_PATH" log \
            "origin/$BRANCH" \
            --format="%H|%aN|%aE|%at|%s" \
            --numstat \
            --author="Vuxyn\|f1d02410052@student.unram.ac.id\|mahesamp19@gmail.com" \
            --after="$LAST_SYNCED" \
            2>/dev/null || echo "")

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

        # Tulis satu commit ke batch file
        write_commit_to_batch() {
            [[ -z "$CURRENT_SHA" ]] && return
            [[ ! "$CURRENT_TS" =~ ^[0-9]+$ ]] && return

            COMMITTED_AT=$(date -d "@$CURRENT_TS" '+%Y-%m-%d %H:%M:%S' 2>/dev/null)
            [[ -z "$COMMITTED_AT" ]] && return

            SAFE_MSG=$(escape_sql "$CURRENT_MSG")
            SAFE_AUTHOR=$(escape_sql "$CURRENT_AUTHOR_NAME")
            SAFE_EMAIL=$(escape_sql "$CURRENT_AUTHOR_EMAIL")
            SAFE_BRANCH=$(escape_sql "$BRANCH")

            cat >> "$BATCH_SQL" << SQLEOF
INSERT INTO commits (repo_id, sha, branch, author_name, author_email, message, lines_added, lines_removed, files_changed, committed_at)
VALUES ($REPO_ID, '$CURRENT_SHA', '$SAFE_BRANCH', '$SAFE_AUTHOR', '$SAFE_EMAIL', '$SAFE_MSG', $LINES_ADDED, $LINES_REMOVED, $FILES_CHANGED, '$COMMITTED_AT')
ON CONFLICT (sha) DO NOTHING;
SQLEOF
            BRANCH_COMMIT_COUNT=$((BRANCH_COMMIT_COUNT + 1))
        }

        while IFS= read -r LINE; do
            [[ -z "$LINE" ]] && continue

            # Count pipes only using bash substitution to avoid multiple fork/exec
            ONLY_PIPES="${LINE//[^|]/}"
            PIPE_COUNT="${#ONLY_PIPES}"

            if [[ $PIPE_COUNT -ge 4 ]]; then
                write_commit_to_batch
                IFS='|' read -r CURRENT_SHA CURRENT_AUTHOR_NAME CURRENT_AUTHOR_EMAIL CURRENT_TS CURRENT_MSG <<< "$LINE"
                LINES_ADDED=0
                LINES_REMOVED=0
                FILES_CHANGED=0
            else
                # read space-separated fields from numstat directly
                IFS=$' \t' read -r ADDED REMOVED FILE_PATH <<< "$LINE"
                
                # Update total commit lines
                if [[ "$ADDED" =~ ^[0-9]+$ ]]; then LINES_ADDED=$((LINES_ADDED + ADDED)); fi
                if [[ "$REMOVED" =~ ^[0-9]+$ ]]; then LINES_REMOVED=$((LINES_REMOVED + REMOVED)); fi
                FILES_CHANGED=$((FILES_CHANGED + 1))

                # Update language stats
                if [[ "$CURRENT_TS" =~ ^[0-9]+$ ]]; then
                    CURR_DATE=$(date -d "@$CURRENT_TS" '+%Y-%m-%d' 2>/dev/null)
                    if [[ -n "$CURR_DATE" ]]; then
                        LANG_NAME=$(get_language "$FILE_PATH")
                        if [[ "$ADDED" =~ ^[0-9]+$ ]]; then
                            KEY="${CURR_DATE}|${LANG_NAME}|added"
                            REPO_LANG_STATS["$KEY"]=$(( ${REPO_LANG_STATS["$KEY"]:-0} + ADDED ))
                        fi
                        if [[ "$REMOVED" =~ ^[0-9]+$ ]]; then
                            KEY="${CURR_DATE}|${LANG_NAME}|removed"
                            REPO_LANG_STATS["$KEY"]=$(( ${REPO_LANG_STATS["$KEY"]:-0} + REMOVED ))
                        fi
                    fi
                fi
            fi
        done <<< "$GIT_LOG"

        # Flush commit terakhir
        write_commit_to_batch

        log "    $BRANCH_COMMIT_COUNT commits dikumpulkan"
        TOTAL_COMMITS_ADDED=$((TOTAL_COMMITS_ADDED + BRANCH_COMMIT_COUNT))

    done <<< "$BRANCHES"

    # ============================================
    # Kirim semua commit dalam satu batch ke database
    # ============================================

    if [[ -s "$BATCH_SQL" ]]; then
        log "  Inserting batch ke database..."
        db_exec_file "$BATCH_SQL"
        log "  Batch insert selesai. Total commits: $TOTAL_COMMITS_ADDED"
    else
        log "  Tidak ada commit baru."
    fi

    rm -f "$BATCH_SQL"

    # Update daily_summary
    log "  Updating daily summary..."
    # Hilangkan > /dev/null 2>&1 agar error dari postgresql terlihat jika gagal masuk ke daily_summary
    db_exec "
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
    "

    # Update language stats di DB
    if [[ ${#REPO_LANG_STATS[@]} -gt 0 ]]; then
        log "  Updating language stats..."
        LANG_BATCH_SQL=$(mktemp /tmp/dev-analytics-lang-XXXXXX.sql)
        
        # Ekstrak semua unik date|lang dari keys
        for KEY in "${!REPO_LANG_STATS[@]}"; do
            if [[ "$KEY" == *"|added" ]]; then
                BASE_KEY="${KEY%|added}"
                IFS='|' read -r L_DATE L_NAME <<< "$BASE_KEY"
                L_ADDED=${REPO_LANG_STATS["$BASE_KEY|added"]:-0}
                L_REMOVED=${REPO_LANG_STATS["$BASE_KEY|removed"]:-0}

                cat >> "$LANG_BATCH_SQL" << SQLEOF
INSERT INTO language_stats (repo_id, date, language, lines_added, lines_removed)
VALUES ($REPO_ID, '$L_DATE', '$L_NAME', $L_ADDED, $L_REMOVED)
ON CONFLICT (repo_id, date, language) DO UPDATE SET
    lines_added = EXCLUDED.lines_added,
    lines_removed = EXCLUDED.lines_removed;
SQLEOF
            fi
        done

        if [[ -s "$LANG_BATCH_SQL" ]]; then
            db_exec_file "$LANG_BATCH_SQL"
        fi
        rm -f "$LANG_BATCH_SQL"
    fi

    db_exec "UPDATE repositories SET last_synced = NOW() WHERE id = $REPO_ID;"

    db_exec "
        INSERT INTO sync_log (repo_id, commits_added, status)
        VALUES ($REPO_ID, $TOTAL_COMMITS_ADDED, '$SYNC_STATUS');
    "

    log "  Done. Commits added: $TOTAL_COMMITS_ADDED"

done

log "Collector selesai."
