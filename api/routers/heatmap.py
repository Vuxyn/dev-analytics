from fastapi import APIRouter
from database import get_conn

router = APIRouter(prefix="/heatmap", tags=["heatmap"])

@router.get("")
async def get_heatmap():
    async with get_conn() as conn:
        rows = await conn.fetch("""
            SELECT
                date,
                SUM(commit_count) AS commits,
                SUM(lines_added) AS lines_added,
                SUM(lines_removed) AS lines_removed
            FROM daily_summary
            GROUP BY date
            ORDER BY date ASC
        """)

        return [
            {
                "date": str(row["date"]),
                "commits": row["commits"],
                "lines_added": row["lines_added"],
                "lines_removed": row["lines_removed"],
            }
            for row in rows
        ]
