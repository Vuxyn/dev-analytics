from fastapi import APIRouter, Query
from database import get_conn

router = APIRouter(prefix="/repos", tags=["repos"])

@router.get("")
async def get_repos(days: int = Query(None, description="Filter by last N days")):
    async with get_conn() as conn:
        params = []
        if days is not None:
            date_filter = "AND ds.date >= CURRENT_DATE - ($1::text || ' days')::interval"
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
