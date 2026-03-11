import asyncio
import os
import sys
from datetime import date, timedelta
import requests
import asyncpg
from dotenv import load_dotenv

# Load env in case it's run locally. In GitHub Actions, Secrets become true env vars.
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
GITHUB_PAT = os.getenv("GITHUB_PAT")
OMNI_NOTIFIER_REPO = os.getenv("OMNI_NOTIFIER_REPO", "vuxyn/omni-notifier")

def trigger_omni_notifier(text):
    if not GITHUB_PAT:
        print("Missing GITHUB_PAT variable")
        return False
        
    url = f"https://api.github.com/repos/{OMNI_NOTIFIER_REPO}/dispatches"
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": f"token {GITHUB_PAT}",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    payload = {
        "event_type": "send_telegram",
        "client_payload": {
            "message": text
        }
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        print(f"Successfully triggered notification via {OMNI_NOTIFIER_REPO}!")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Failed to trigger omni-notifier: {e}")
        if e.response is not None:
            print(f"Response: {e.response.text}")
        return False

async def calculate_streak(conn):
    # Get all unique dates where user committed something, ordered from newest to oldest
    dates = await conn.fetch("""
        SELECT DISTINCT date 
        FROM daily_summary 
        WHERE commit_count > 0 
        ORDER BY date DESC
    """)
    
    if not dates:
        return 0, False

    streak = 0
    today = date.today()
    yesterday = today - timedelta(days=1)
    
    has_coded_today = False
    
    # Check if we should start counting from today or yesterday
    first_date = dates[0]['date']
    
    if first_date == today:
        has_coded_today = True
        current_check_date = today
    elif first_date == yesterday:
        has_coded_today = False
        current_check_date = yesterday
    else:
        # No commits today or yesterday, streak is officially broken/zero
        return 0, False
        
    # Calculate consecutive days
    # We iterate through the dates and see if they match our expected "one day less" pattern
    date_list = [d['date'] for d in dates]
    
    for d in date_list:
        if d == current_check_date:
            streak += 1
            current_check_date -= timedelta(days=1)
        else:
            break
            
    return streak, has_coded_today

async def main():
    if not DATABASE_URL:
        print("DATABASE_URL not found in environment variables.")
        sys.exit(1)

    try:
        conn = await asyncpg.connect(DATABASE_URL)
        
        print("Calculating current streak...")
        streak, has_coded_today = await calculate_streak(conn)
        
        schedule_time = os.getenv("SCHEDULE_TIME", "")
        is_morning = "0 1 *" in schedule_time
        is_evening = "0 13 *" in schedule_time
        
        # If run manually via workflow_dispatch, default to a generic message format
        if not is_morning and not is_evening:
            # Let's just guess based on the current UTC time instead of the cron string
            from datetime import datetime
            current_hour = datetime.utcnow().hour
            is_morning = current_hour < 10
        
        if is_morning:
            if not has_coded_today:
                if streak > 0:
                    msg = f"*Selamat Pagi!*\n\nStreak codingmu saat ini adalah *{streak} hari*. Jangan lupa nyicil kodingan hari ini ya biar streaknya nggak putus! 🔥"
                else:
                    msg = f"*Selamat Pagi!*\n\nYuk mulai hari ini dengan buka IDE-mu dan bangun streak baru! 🚀"
            else:
                msg = f"*Selamat Pagi!*\n\nRajin banget! Pagi-pagi udah coding aja. Streakmu saat ini *{streak} hari* 🚀"
        else:
            # Evening reminder
            if not has_coded_today:
                if streak > 0:
                    msg = f"⚠️ *Peringatan Malam!*\n\nHari udah mau ganti, tapi kamu belum nulis kode sama sekali! Jangan sampai streak *{streak} hari* mu hancur sia-sia. Ayo gas 1 commit aja! 💻"
                else:
                    msg = f"*Malam!*\n\nHari ini kamu belum coding. Nggak apa-apa istirahat, besok kita mulai bangun streak baru lagi ya! 💤"
            else:
                msg = f"🎉 *Rekap Harian*\n\nMantap! Hari ini kamu udah coding. Streak bertahan di *{streak} hari* berturut-turut. Selamat beristirahat! 🏆"
            
        print(f"Message to send: \n{msg}")
        trigger_omni_notifier(msg)
        
    except Exception as e:
        print(f"Error occurred: {e}")
        sys.exit(1)
    finally:
        if 'conn' in locals():
            await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
