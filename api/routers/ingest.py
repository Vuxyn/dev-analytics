from fastapi import APIRouter, HTTPException, Request, Depends, Header
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import time
from collections import defaultdict

from database import get_conn

router = APIRouter(prefix="/ingest", tags=["ingest"])

# --- Models ---
class CommitData(BaseModel):
    hash: str
    branch: str
    author: str
    email: str
    date: str
    message: str
    insertions: int
    deletions: int
    files: int

class LanguageStat(BaseModel):
    language: str
    date: str
    lines_added: int
    lines_removed: int

class RepoData(BaseModel):
    name: str
    path: str
    remote: Optional[str]
    commits: List[CommitData]
    languages: List[LanguageStat] = []

class IngestPayload(BaseModel):
    username: str
    repositories: List[RepoData]

# --- Rate Limiting (Redis & In-Memory Fallback) ---
import os
import redis.asyncio as redis

RATE_LIMIT_DURATION = 60
MAX_REQUESTS_PER_MINUTE = 20
SESSION_GAP_HOURS = 2  # cross-repo gap to split sessions

_redis_client = None
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
_rate_limits = {}

async def get_redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client

async def check_rate_limit(request: Request):
    client_ip = request.client.host
    try:
        r = await get_redis()
        key = f"rate_limit:{client_ip}"
        current = await r.incr(key)
        if current == 1:
            await r.expire(key, RATE_LIMIT_DURATION)
        if current > MAX_REQUESTS_PER_MINUTE:
            raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
        return
    except Exception:
        pass

    now = time.time()
    if client_ip not in _rate_limits:
        _rate_limits[client_ip] = []
    _rate_limits[client_ip] = [t for t in _rate_limits[client_ip] if now - t < RATE_LIMIT_DURATION]
    if len(_rate_limits[client_ip]) >= MAX_REQUESTS_PER_MINUTE:
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
    _rate_limits[client_ip].append(now)

# --- Endpoint ---
@router.post("/commits", dependencies=[Depends(check_rate_limit)])
async def ingest_commits(payload: IngestPayload, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header (Auto-PIN required)")

    pin = authorization.split("Bearer ")[1]
    username = payload.username

    async with get_conn() as conn:
        # 1. Authenticate / Register User
        user = await conn.fetchrow("SELECT id, auto_pin FROM users WHERE username = $1", username)
        if not user:
            user_id = await conn.fetchval(
                "INSERT INTO users (username, auto_pin) VALUES ($1, $2) RETURNING id",
                username, pin
            )
        else:
            if user["auto_pin"] != pin:
                raise HTTPException(status_code=403, detail="Invalid PIN for this username.")
            user_id = user["id"]

        # 2. Process each repo — collect all parsed commits for cross-repo session detection
        total_inserted = 0
        # all_events: list of (committed_at, repo_id, branch, lines_added, lines_removed)
        all_events: list = []

        for repo in payload.repositories:
            repo_id = await conn.fetchval("""
                INSERT INTO repositories (user_id, name, path, remote_url, last_synced)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (user_id, path)
                DO UPDATE SET remote_url = EXCLUDED.remote_url, last_synced = NOW()
                RETURNING id
            """, user_id, repo.name, repo.path, repo.remote)

            commit_args = []
            daily: dict = defaultdict(lambda: {
                "commits": 0, "lines_added": 0, "lines_removed": 0,
                "files": 0, "hours": set(), "branches": set()
            })

            for commit in repo.commits:
                try:
                    committed_at = datetime.fromisoformat(commit.date.replace("Z", "+00:00"))
                    committed_at = committed_at.replace(tzinfo=None)
                except ValueError:
                    continue

                commit_args.append((
                    repo_id, user_id, commit.hash, commit.branch,
                    commit.author, commit.email, commit.message,
                    commit.insertions, commit.deletions, commit.files, committed_at
                ))

                day = committed_at.date()
                daily[day]["commits"] += 1
                daily[day]["lines_added"] += commit.insertions
                daily[day]["lines_removed"] += commit.deletions
                daily[day]["files"] += commit.files
                daily[day]["hours"].add(committed_at.hour)
                daily[day]["branches"].add(commit.branch)

                # Collect for cross-repo session detection
                all_events.append((committed_at, repo_id, commit.branch, commit.insertions, commit.deletions))

            if commit_args:
                await conn.executemany("""
                    INSERT INTO commits (repo_id, user_id, sha, branch, author_name, author_email, message, lines_added, lines_removed, files_changed, committed_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (repo_id, sha) DO NOTHING
                """, commit_args)
                total_inserted += len(commit_args)

            for day, agg in daily.items():
                await conn.execute("""
                    INSERT INTO daily_summary (repo_id, user_id, date, commit_count, lines_added, lines_removed, files_changed, active_hours, branches)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (repo_id, date, user_id)
                    DO UPDATE SET
                        commit_count  = daily_summary.commit_count  + EXCLUDED.commit_count,
                        lines_added   = daily_summary.lines_added   + EXCLUDED.lines_added,
                        lines_removed = daily_summary.lines_removed + EXCLUDED.lines_removed,
                        files_changed = daily_summary.files_changed + EXCLUDED.files_changed,
                        active_hours  = EXCLUDED.active_hours,
                        branches      = EXCLUDED.branches
                """,
                    repo_id, user_id, day,
                    agg["commits"], agg["lines_added"], agg["lines_removed"], agg["files"],
                    list(agg["hours"]), list(agg["branches"])
                )

            # Upsert language_stats from collector data
            for lang in repo.languages:
                try:
                    lang_date = datetime.fromisoformat(lang.date).date()
                except ValueError:
                    continue
                await conn.execute("""
                    INSERT INTO language_stats (repo_id, user_id, date, language, lines_added, lines_removed)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (repo_id, date, language, user_id)
                    DO UPDATE SET
                        lines_added   = language_stats.lines_added   + EXCLUDED.lines_added,
                        lines_removed = language_stats.lines_removed + EXCLUDED.lines_removed
                """, repo_id, user_id, lang_date, lang.language, lang.lines_added, lang.lines_removed)

        # 3. Cross-repo session detection (gap > 2 hours = new session)
        if all_events:
            all_events.sort(key=lambda e: e[0])  # sort by committed_at

            sessions = []
            s_start = all_events[0][0]
            s_end = all_events[0][0]
            s_commits = 0
            s_added = 0
            s_removed = 0
            s_branches: set = set()

            for committed_at, repo_id, branch, added, removed in all_events:
                gap_hours = (committed_at - s_end).total_seconds() / 3600
                if gap_hours > SESSION_GAP_HOURS and s_commits > 0:
                    duration = max(1, int((s_end - s_start).total_seconds() / 60))
                    sessions.append((
                        user_id, s_start, s_end, duration,
                        s_commits, s_added, s_removed, list(s_branches)
                    ))
                    s_start = committed_at
                    s_commits = 0
                    s_added = 0
                    s_removed = 0
                    s_branches = set()

                s_end = committed_at
                s_commits += 1
                s_added += added
                s_removed += removed
                s_branches.add(branch)

            # Flush last session
            if s_commits > 0:
                duration = max(1, int((s_end - s_start).total_seconds() / 60))
                sessions.append((
                    user_id, s_start, s_end, duration,
                    s_commits, s_added, s_removed, list(s_branches)
                ))

            if sessions:
                await conn.executemany("""
                    INSERT INTO coding_sessions
                        (repo_id, user_id, started_at, ended_at, duration_minutes,
                         commit_count, lines_added, lines_removed, branches)
                    VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8)
                """, sessions)

        return {"status": "success", "message": f"Processed {total_inserted} commits for {username}."}
