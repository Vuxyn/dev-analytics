# 📊 Dev-Analytics

> **Self-hosted coding analytics dashboard** — track your Git activity across all repositories, visualized in a beautiful Next.js dashboard.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Vuxyn/dev-analytics)

---

## ✨ Features

- 📈 **Commit heatmap** — visualize your daily coding activity
- 🗂️ **Multi-repo tracking** — scan all your Git repos automatically
- 🌐 **Multi-tenant** — each user gets their own dashboard at `/u/[username]`
- 🔍 **GitHub Preview fallback** — view any GitHub user's public stats without installing anything
- ⚡ **Auto-PIN auth** — zero-friction authentication for data ingestion (no passwords to set up)
- 🛡️ **Rate limiting** — Redis-backed protection against spam
- 🔁 **Idempotent ingestion** — safe to re-sync, no duplicate commits
- 🐳 **Dockerized backend** — deploy anywhere in seconds

---

## 🏗️ Architecture

```
Your Machine                  Cloud
──────────────                ──────────────────────────────────
Git Repos
    │
    ▼
collect.sh ──POST JSON──► Render (FastAPI)
(runs hourly via cron)          │
                                ▼
                          Supabase (PostgreSQL)
                                △
                                │
                          Vercel (Next.js) ◄── Browser / Phone
```

---

## 🚀 Quick Start (End User)

If someone gives you a link to their dev-analytics instance, you can install the collector on your machine with **one command**:

```bash
curl -fsSL https://raw.githubusercontent.com/Vuxyn/dev-analytics/main/install.sh | bash
```

This will:
1. Check for dependencies (`curl`, `jq`, `git`)
2. Ask for your GitHub username
3. Generate a secret Auto-PIN and store it securely in `~/.dev-analytics/config.env`
4. Download the `collect.sh` collector script
5. Set up an **hourly cron job** to auto-sync your commits

To sync your full git history immediately after install:
```bash
SYNC_DAYS=all ~/.dev-analytics/collect.sh
```

---

## 🖥️ Viewing the Dashboard

Open your browser (any device — PC, phone, tablet):

```
https://your-vercel-domain.vercel.app/u/YOUR_GITHUB_USERNAME
```

If you haven't installed the collector yet, the dashboard will show a **GitHub preview** of your public repositories automatically.

---

## 🛠️ Self-Hosting

### Prerequisites

- **Supabase** account (free tier is fine)
- **Render** or any cloud for FastAPI backend
- **Vercel** for Next.js frontend
- **Upstash Redis** (optional, for production rate limiting)

### 1. Database Setup (Supabase)

1. Create a new project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** and run the contents of [`sql/schema.sql`](./sql/schema.sql)
3. Copy your **Connection Pooler URI** from Project Settings → Database → Connection String

### 2. Backend (FastAPI on Render)

1. Connect your GitHub repo to [render.com](https://render.com)
2. Create a **Web Service** with:
   - **Root Directory:** `api`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Set environment variables:
   ```
   DATABASE_URL=postgresql://postgres.xxx:password@...pooler.supabase.com:5432/postgres?sslmode=require
   REDIS_URL=rediss://...@upstash.io:6379   # optional
   ```

### 3. Frontend (Next.js on Vercel)

1. Import the repo on [vercel.com](https://vercel.com)
2. Set **Root Directory** to `dashboard`
3. Set environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-api.onrender.com
   ```
4. Deploy!

### 4. Local Development (Docker)

```bash
cp .env.example .env
# Fill in DATABASE_URL and REDIS_URL in .env

docker-compose up
```

API: `http://localhost:8000`  
Docs: `http://localhost:8000/docs`

---

## 📁 Project Structure

```
dev-analytics/
├── api/                  # FastAPI backend
│   ├── routers/          # Endpoints: summary, repos, heatmap, sessions, ingest, ...
│   ├── main.py           # App entrypoint
│   ├── database.py       # asyncpg connection pool
│   ├── Dockerfile
│   └── requirements.txt
│
├── dashboard/            # Next.js frontend (deployed on Vercel)
│   ├── app/
│   │   ├── page.tsx               # Landing page (username search)
│   │   └── u/[username]/          # User dashboard (dynamic routing)
│   ├── components/
│   └── lib/
│       └── github.ts              # GitHub API fallback helper
│
├── collector/
│   └── collect.sh        # Git log → JSON → POST to API
│
├── sql/
│   └── schema.sql        # Supabase table definitions
│
├── install.sh            # One-liner installer for end users
└── docker-compose.yml    # Local dev stack
```

---

## 🔐 Authentication (Auto-PIN / TOFU)

This project uses a **Trust-On-First-Use** model for data ingestion:

- When you run `install.sh`, it generates a random 6-char hex PIN (e.g., `8f92bd`)
- Every POST to the API includes this PIN in the `Authorization` header
- **Subsequent requests**: PIN is validated — mismatched PIN = request rejected

This prevents others from submitting fake data under your username, while requiring zero effort from the user (no signup, no login page).

> The **dashboard is public read** — anyone can view `/u/username` without authentication.

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/summary?username=X` | Commit & lines summary |
| `GET` | `/heatmap?username=X` | Daily commit heatmap |
| `GET` | `/repos?username=X` | Repository list |
| `GET` | `/languages?username=X` | Language breakdown |
| `GET` | `/sessions?username=X` | Coding session data |
| `POST` | `/ingest/commits` | Submit commit batch (requires PIN) |
| `GET` | `/health` | Health check |

---

## 📄 License

MIT
