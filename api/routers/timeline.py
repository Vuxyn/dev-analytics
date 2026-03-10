from fastapi import APIRouter, HTTPException, Query
from database import get_conn

router = APIRouter(prefix="/timeline", tags=["timeline"])


@router.get("/{repo_id}")
async def get_timeline(repo_id: int, days: int = Query(None, description="Filter by last N days")):
    async with get_conn() as conn:
        repo = await conn.fetchrow("""
            SELECT id, name FROM repositories WHERE id = $1
        """, repo_id)

        if not repo:
            raise HTTPException(status_code=404, detail="Repo tidak ditemukan")

        params = [repo_id]
        if days is not None:
            date_filter = "AND date >= CURRENT_DATE - ($2::text || ' days')::interval"
            params.append(days)
        else:
            date_filter = ""

        query = f"""
            SELECT
                date,
                commit_count,
                lines_added,
                lines_removed,
                files_changed,
                active_hours,
                branches
            FROM daily_summary
            WHERE repo_id = $1 {date_filter}
            ORDER BY date ASC
        """
        rows = await conn.fetch(query, *params)

    return {
        "repo_id": repo["id"],
        "repo_name": repo["name"],
        "timeline": [
            {
                "date": str(row["date"]),
                "commit_count": row["commit_count"],
                "lines_added": row["lines_added"],
                "lines_removed": row["lines_removed"],
                "files_changed": row["files_changed"],
                "active_hours": row["active_hours"],
                "branches": row["branches"],
            }
            for row in rows
        ]
    }
