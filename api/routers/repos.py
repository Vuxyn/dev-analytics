from fastapi import APIRouter, Query
from database import get_conn

router = APIRouter(prefix="/repos", tags=["repos"])

from fastapi import HTTPException
@router.get("")
async def get_repos(username: str, days: int = Query(None, description="Filter by last N days")):
    try:
        async with get_conn() as conn:
            user_id = await conn.fetchval("SELECT id FROM users WHERE username = $1", username)
            if not user_id:
                raise HTTPException(status_code=404, detail="User not found")

            params = [user_id]
            if days is not None:
                date_filter = "AND ds.date >= CURRENT_DATE - ($2 * INTERVAL '1 day')"
                params.append(days)
            else:
                date_filter = ""

            query = f"""
                SELECT
                    r.id,
                    r.name,
                    r.remote_url,
                    r.last_synced,
                    COALESCE(SUM(ds.commit_count), 0)  AS total_commits,
                    COALESCE(SUM(ds.lines_added), 0)   AS total_lines_added,
                    COALESCE(SUM(ds.lines_removed), 0) AS total_lines_removed
                FROM repositories r
                LEFT JOIN daily_summary ds ON ds.repo_id = r.id {date_filter}
                WHERE r.user_id = $1
                GROUP BY r.id
                ORDER BY total_commits DESC
            """
            rows = await conn.fetch(query, *params)
            return [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "remote_url": row["remote_url"],
                    "last_synced": str(row["last_synced"]) if row["last_synced"] else None,
                    "total_commits": row["total_commits"],
                    "total_lines_added": row["total_lines_added"],
                    "total_lines_removed": row["total_lines_removed"],
                }
                for row in rows
            ]
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
