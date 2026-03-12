-- Migration: Fix duplicate data accumulation bugs
-- 1. Add unique constraint to coding_sessions to enable ON CONFLICT upsert
-- 2. Clean up existing duplicate sessions before adding constraint

-- Step 1: Remove duplicate coding_sessions (keep the one with lowest id per user+started_at)
DELETE FROM coding_sessions
WHERE id NOT IN (
    SELECT MIN(id)
    FROM coding_sessions
    GROUP BY user_id, started_at
);

-- Step 2: Add unique constraint so future ingests deduplicate properly
ALTER TABLE coding_sessions
    ADD CONSTRAINT uq_coding_sessions_user_started
    UNIQUE (user_id, started_at);

-- Step 3: Recalculate daily_summary from actual commits to fix already-accumulated data.
-- This replaces all existing daily_summary rows with correct values derived from deduplicated commits.
INSERT INTO daily_summary (repo_id, user_id, date, commit_count, lines_added, lines_removed, files_changed, active_hours, branches)
SELECT
    repo_id,
    user_id,
    committed_at::date AS date,
    COUNT(*) AS commit_count,
    SUM(lines_added) AS lines_added,
    SUM(lines_removed) AS lines_removed,
    SUM(files_changed) AS files_changed,
    array_agg(DISTINCT extract(hour FROM committed_at)::int) AS active_hours,
    array_agg(DISTINCT branch) AS branches
FROM commits
GROUP BY repo_id, user_id, committed_at::date
ON CONFLICT (repo_id, date, user_id) DO UPDATE SET
    commit_count  = EXCLUDED.commit_count,
    lines_added   = EXCLUDED.lines_added,
    lines_removed = EXCLUDED.lines_removed,
    files_changed = EXCLUDED.files_changed,
    active_hours  = EXCLUDED.active_hours,
    branches      = EXCLUDED.branches;

-- Step 4: Recalculate language_stats from scratch is not straightforward (data comes from
-- collector, not from raw commits). If your numbers look inflated, you can reset and re-run
-- collect.sh once:
--   TRUNCATE language_stats;
-- Then run collect.sh to repopulate with correct (non-accumulated) values.
