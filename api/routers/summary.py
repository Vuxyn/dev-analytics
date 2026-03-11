from fastapi import APIRouter, Query
from database import get_conn

router = APIRouter(prefix="/summary", tags=["summary"])


from fastapi import HTTPException
@router.get("")
async def get_summary(username: str, days: int = Query(None, description="Filter by last N days")):
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
                WHERE user_id = $1
                {date_filter}
            """
            stats = await conn.fetchrow(stats_query, *params)

            # most_active uses its own param list
            if days is not None:
                most_active_query = """
                    SELECT r.name,
                           COALESCE(SUM(ds.commit_count), 0) AS total_commits
                    FROM repositories r
                    LEFT JOIN daily_summary ds
                          ON ds.repo_id = r.id
                         AND ds.user_id = $1
                         AND ds.date >= CURRENT_DATE - ($2 * INTERVAL '1 day')
                    WHERE r.user_id = $1
                    GROUP BY r.id, r.name
                    ORDER BY total_commits DESC
                    LIMIT 3
                """
                most_active = await conn.fetch(most_active_query, user_id, days)
            else:
                most_active_query = """
                    SELECT r.name,
                           COALESCE(SUM(ds.commit_count), 0) AS total_commits
                    FROM repositories r
                    LEFT JOIN daily_summary ds
                          ON ds.repo_id = r.id
                         AND ds.user_id = $1
                    WHERE r.user_id = $1
                    GROUP BY r.id, r.name
                    ORDER BY total_commits DESC
                    LIMIT 3
                """
                most_active = await conn.fetch(most_active_query, user_id)

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
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
