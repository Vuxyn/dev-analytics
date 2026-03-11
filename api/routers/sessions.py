from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from database import get_pool

router = APIRouter(
    prefix="/sessions",
    tags=["Sessions"],
)

class SessionGrouped(BaseModel):
    id: int
    repo_id: int
    started_at: datetime
    ended_at: datetime
    duration_minutes: int
    commit_count: int
    lines_added: int
    lines_removed: int
    branches: List[str]

    class Config:
        from_attributes = True

from fastapi import APIRouter, HTTPException
@router.get("/", response_model=List[SessionGrouped])
async def get_sessions(username: str, repo_id: Optional[int] = None, limit: int = 50, offset: int = 0):
    pool = get_pool()
    async with pool.acquire() as conn:
        user_id = await conn.fetchval("SELECT id FROM users WHERE username = $1", username)
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")

        if repo_id:
            rows = await conn.fetch(
                """
                SELECT id, repo_id, started_at, ended_at, duration_minutes, 
                       commit_count, lines_added, lines_removed, branches
                FROM coding_sessions
                WHERE repo_id = $1 AND user_id = $4
                ORDER BY started_at DESC
                LIMIT $2 OFFSET $3
                """,
                repo_id, limit, offset, user_id
            )
        else:
            rows = await conn.fetch(
                """
                SELECT id, repo_id, started_at, ended_at, duration_minutes, 
                       commit_count, lines_added, lines_removed, branches
                FROM coding_sessions
                WHERE user_id = $3
                ORDER BY started_at DESC
                LIMIT $1 OFFSET $2
                """,
                limit, offset, user_id
            )
    
    return [dict(row) for row in rows]

@router.get("/summary")
async def get_sessions_summary(username: str, repo_id: Optional[int] = None, days: Optional[int] = None):
    pool = get_pool()
    async with pool.acquire() as conn:
        user_id = await conn.fetchval("SELECT id FROM users WHERE username = $1", username)
        if not user_id:
            raise HTTPException(status_code=404, detail="User not found")

        row = await conn.fetchrow("""
            SELECT 
                COUNT(*) as total_sessions,
                COALESCE(SUM(duration_minutes), 0) as total_duration_minutes,
                COALESCE(AVG(duration_minutes), 0) as average_duration_minutes
            FROM coding_sessions
            WHERE user_id = $3
            AND ($1::int IS NULL OR repo_id = $1)
            AND ($2::int IS NULL OR started_at >= NOW() - INTERVAL '1 day' * $2)
        """, repo_id, days, user_id)
            
    summary = dict(row)
    summary['average_duration_minutes'] = float(summary['average_duration_minutes'])
    summary['total_duration_minutes'] = int(summary['total_duration_minutes'])
    return summary
