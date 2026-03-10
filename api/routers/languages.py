from fastapi import APIRouter, Query
from database import get_conn

router = APIRouter(prefix="/languages", tags=["languages"])

@router.get("")
async def get_language_stats(
    repo_id: int = Query(None),
    days: int = Query(None)
):
    try:
        async with get_conn() as conn:
            params = []
            where_clauses = []
            
            if repo_id:
                where_clauses.append(f"repo_id = ${len(params) + 1}")
                params.append(repo_id)
            
            if days:
                where_clauses.append(f"date >= CURRENT_DATE - (${len(params) + 1} * INTERVAL '1 day')")
                params.append(days)
            
            where_str = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
            
            query = f"""
                SELECT 
                    language,
                    SUM(lines_added) as lines_added,
                    SUM(lines_removed) as lines_removed,
                    SUM(lines_added + lines_removed) as total_changes
                FROM language_stats
                {where_str}
                GROUP BY language
                ORDER BY total_changes DESC
            """
            
            rows = await conn.fetch(query, *params)
            
            return [
                {
                    "language": row["language"],
                    "lines_added": row["lines_added"],
                    "lines_removed": row["lines_removed"],
                    "total_changes": row["total_changes"]
                }
                for row in rows
            ]
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
