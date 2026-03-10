from fastapi import APIRouter, Query
from database import get_conn

router = APIRouter(prefix="/heatmap", tags=["heatmap"])

@router.get("")
async def get_heatmap(days: int = Query(None, description="Filter by last N days")):
    async with get_conn() as conn:
        date_filter = ""
        params = []
        if days is not None:
            date_filter = "WHERE date >= CURRENT_DATE - ($1 || ' days')::interval"
            params.append(days)

        query = f"""
            SELECT
                date,
                SUM(commit_count) AS commits,
                SUM(lines_added) AS lines_added,
                SUM(lines_removed) AS lines_removed
            FROM daily_summary
            {date_filter}
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
