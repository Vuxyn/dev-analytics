from fastapi import APIRouter, Query
from database import get_conn

router = APIRouter(prefix="/summary", tags=["summary"])


@router.get("")
async def get_summary(days: int = Query(None, description="Filter by last N days")):
    async with get_conn() as conn:
        date_filter = ""
        params = []
        if days is not None:
            date_filter = "WHERE date >= CURRENT_DATE - ($1 || ' days')::interval"
            params.append(days)

        stats_query = f"""
            SELECT
                COUNT(DISTINCT repo_id)  AS total_repos,
                COALESCE(SUM(commit_count), 0)  AS total_commits,
                COALESCE(SUM(lines_added), 0)   AS total_lines_added,
                COALESCE(SUM(lines_removed), 0) AS total_lines_removed,
                COALESCE(SUM(files_changed), 0) AS total_files_changed,
                MIN(date) AS first_commit_date,
                MAX(date) AS last_commit_date
            FROM daily_summary
            {date_filter}
        """
        stats = await conn.fetchrow(stats_query, *params)

        most_active_query = f"""
            SELECT
                r.name,
                COALESCE(SUM(ds.commit_count), 0) AS total_commits
            FROM repositories r
            LEFT JOIN daily_summary ds ON ds.repo_id = r.id AND ({'ds.date >= CURRENT_DATE - ($1 || \' days\')::interval' if days is not None else 'TRUE'})
            GROUP BY r.id, r.name
            ORDER BY total_commits DESC
            LIMIT 3
        """
        most_active = await conn.fetch(most_active_query, *params)

    return {
        "total_repos": stats["total_repos"],
        "total_commits": stats["total_commits"],
        "total_lines_added": stats["total_lines_added"],
        "total_lines_removed": stats["total_lines_removed"],
        "total_files_changed": stats["total_files_changed"],
        "first_commit_date": str(stats["first_commit_date"]) if stats["first_commit_date"] else None,
        "last_commit_date": str(stats["last_commit_date"]) if stats["last_commit_date"] else None,
        "most_active_repos": [
            {"name": row["name"], "total_commits": row["total_commits"]}
            for row in most_active
        ],
    }
