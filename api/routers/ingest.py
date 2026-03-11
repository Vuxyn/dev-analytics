from fastapi import APIRouter, HTTPException, Request, Depends, Header
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import time

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

class RepoData(BaseModel):
    name: str
    path: str
    remote: Optional[str]
    commits: List[CommitData]

class IngestPayload(BaseModel):
    username: str
    repositories: List[RepoData]

# --- Rate Limiting (Redis & In-Memory Fallback) ---
import os
import redis.asyncio as redis

RATE_LIMIT_DURATION = 60 # seconds
MAX_REQUESTS_PER_MINUTE = 20

_redis_client = None
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
_rate_limits = {} # fallback memory

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
    except Exception as e:
        # Fallback if Redis is unavailable or unconfigured
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
        # 1. Authenticate User
        user = await conn.fetchrow("SELECT id, auto_pin FROM users WHERE username = $1", username)
        
        if not user:
            # First time user! Register them with this PIN.
            user_id = await conn.fetchval(
                "INSERT INTO users (username, auto_pin) VALUES ($1, $2) RETURNING id", 
                username, pin
            )
        else:
            if user["auto_pin"] != pin:
                raise HTTPException(status_code=403, detail="Invalid PIN for this username.")
            user_id = user["id"]

        # 2. Process Repositories & Commits
        total_inserted = 0
        for repo in payload.repositories:
            # Upsert Repository
            repo_id = await conn.fetchval("""
                INSERT INTO repositories (user_id, name, path, remote_url, last_synced)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (user_id, path) 
                DO UPDATE SET remote_url = EXCLUDED.remote_url, last_synced = NOW()
                RETURNING id
            """, user_id, repo.name, repo.path, repo.remote)

            # Prepare arguments for batch execution
            commit_args = []
            for commit in repo.commits:
                try:
                    # Parse the ISO format date. The collector returns proper UTC (Z / +00:00).
                    # asyncpg expects a naive datetime for a TIMESTAMP column (storing it as UTC conceptually).
                    committed_at = datetime.fromisoformat(commit.date.replace("Z", "+00:00"))
                    committed_at = committed_at.replace(tzinfo=None) # Strip timezone
                except ValueError:
                    continue # Skip invalid dates
                
                commit_args.append((
                    repo_id, user_id, commit.hash, commit.branch,
                    commit.author, commit.email, commit.message,
                    commit.insertions, commit.deletions, commit.files, committed_at
                ))
            
            if commit_args:
                await conn.executemany("""
                    INSERT INTO commits (repo_id, user_id, sha, branch, author_name, author_email, message, lines_added, lines_removed, files_changed, committed_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (repo_id, sha) DO NOTHING
                """, commit_args)
                # Note: executemany with ON CONFLICT doesn't return the exact number of rows inserted in asyncpg.
                # We count the number of processed records instead.
                total_inserted += len(commit_args)

        return {"status": "success", "message": f"Processed {total_inserted} commits for {username}."}
