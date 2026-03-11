from fastapi import APIRouter, Query
from database import get_conn

router = APIRouter(prefix="/heatmap", tags=["heatmap"])

from fastapi import HTTPException
@router.get("")
async def get_heatmap(username: str, days: int = Query(None, description="Filter by last N days")):
    try:
        async with get_conn() as conn:
            user_id = await conn.fetchval("SELECT id FROM users WHERE username = $1", username)
            if not user_id:
                raise HTTPException(status_code=404, detail="User not found")

            date_filter = ""
            params = [user_id]
            if days is not None:
                date_filter = "AND date >= CURRENT_DATE - ($2 * INTERVAL '1 day')"
                params.append(days)

            query = f"""
                SELECT
                    date,
                    SUM(commit_count) AS commits,
                    SUM(lines_added) AS lines_added,
                    SUM(lines_removed) AS lines_removed
                FROM daily_summary
                WHERE user_id = $1 {date_filter}
                GROUP BY date
                ORDER BY date ASC
            """
            rows = await conn.fetch(query, *params)

            return [
                {
                    "date": str(row["date"]),
                    "commits": row["commits"],
                    "lines_added": row["lines_added"],
                    "lines_removed": row["lines_removed"],
                }
                for row in rows
            ]
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
