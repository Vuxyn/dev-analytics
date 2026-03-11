import argparse
import asyncio
import os
import sys
from datetime import timedelta
import asyncpg
from dotenv import load_dotenv

parser = argparse.ArgumentParser(description="Calculate coding sessions")
parser.add_argument("repo_id", type=int, nargs="?", help="Repo ID to calculate sessions for")
parser.add_argument("--env", type=str, help="Path to .env file", default=None)
args = parser.parse_args()

if args.env:
    load_dotenv(args.env)
else:
    load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
SESSION_THRESHOLD = timedelta(hours=2)

async def calculate_sessions_for_repo(conn: asyncpg.Connection, repo_id: int):
    # Fetch all commits for the repo, ordered by committed_at
    commits = await conn.fetch("""
        SELECT sha, branch, lines_added, lines_removed, committed_at
        FROM commits
        WHERE repo_id = $1
        ORDER BY committed_at ASC
    """, repo_id)

    if not commits:
        return

    # Delete existing sessions for this repo since we are recalculating
    await conn.execute("DELETE FROM coding_sessions WHERE repo_id = $1", repo_id)

    sessions = []
    
    current_session = None

    for commit in commits:
        committed_at = commit['committed_at']

        if current_session is None:
            # Start first session
            current_session = {
                "started_at": committed_at,
                "ended_at": committed_at,
                "commit_count": 1,
                "lines_added": commit['lines_added'],
                "lines_removed": commit['lines_removed'],
                "branches": {commit['branch']}
            }
        else:
            gap = committed_at - current_session['ended_at']
            
            if gap <= SESSION_THRESHOLD:
                # Extend current session
                current_session['ended_at'] = committed_at
                current_session['commit_count'] += 1
                current_session['lines_added'] += commit['lines_added']
                current_session['lines_removed'] += commit['lines_removed']
                current_session['branches'].add(commit['branch'])
            else:
                # Save previous session and start new
                duration = current_session['ended_at'] - current_session['started_at']
                duration_minutes = int(duration.total_seconds() // 60)
                
                sessions.append((
                    repo_id,
                    current_session['started_at'],
                    current_session['ended_at'],
                    duration_minutes,
                    current_session['commit_count'],
                    current_session['lines_added'],
                    current_session['lines_removed'],
                    list(current_session['branches'])
                ))

                current_session = {
                    "started_at": committed_at,
                    "ended_at": committed_at,
                    "commit_count": 1,
                    "lines_added": commit['lines_added'],
                    "lines_removed": commit['lines_removed'],
                    "branches": {commit['branch']}
                }

    # Don't forget to save the very last session
    if current_session is not None:
        duration = current_session['ended_at'] - current_session['started_at']
        duration_minutes = int(duration.total_seconds() // 60)
        
        sessions.append((
            repo_id,
            current_session['started_at'],
            current_session['ended_at'],
            duration_minutes,
            current_session['commit_count'],
            current_session['lines_added'],
            current_session['lines_removed'],
            list(current_session['branches'])
        ))

    if sessions:
        await conn.copy_records_to_table(
            'coding_sessions',
            columns=[
                'repo_id', 'started_at', 'ended_at', 'duration_minutes', 
                'commit_count', 'lines_added', 'lines_removed', 'branches'
            ],
            records=sessions
        )
        print(f"Inserted {len(sessions)} sessions for repo {repo_id}")
    else:
        print(f"No sessions to insert for repo {repo_id}")

async def main():
    if not DATABASE_URL:
        print("DATABASE_URL not found in environment variables.")
        sys.exit(1)

    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        if args.repo_id:
            print(f"Calculating sessions for repo_id: {args.repo_id}")
            await calculate_sessions_for_repo(conn, args.repo_id)
        else:
            print("Calculating sessions for all repos...")
            repos = await conn.fetch("SELECT id FROM repositories")
            for repo in repos:
                await calculate_sessions_for_repo(conn, repo['id'])
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
