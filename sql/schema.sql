CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    auto_pin VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repositories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    path TEXT NOT NULL,
    remote_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    last_synced TIMESTAMP,
    UNIQUE(user_id, path)
);

CREATE TABLE IF NOT EXISTS commits (
    id            SERIAL PRIMARY KEY,
    repo_id       INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sha           VARCHAR(40) NOT NULL,
    branch        VARCHAR(255) NOT NULL,
    author_name   VARCHAR(255),
    author_email  VARCHAR(255),
    message       TEXT,
    lines_added   INTEGER DEFAULT 0,
    lines_removed INTEGER DEFAULT 0,
    files_changed INTEGER DEFAULT 0,
    committed_at  TIMESTAMP NOT NULL,
    UNIQUE(repo_id, sha)
);

CREATE INDEX IF NOT EXISTS idx_commits_repo_id      ON commits(repo_id);
CREATE INDEX IF NOT EXISTS idx_commits_user_id      ON commits(user_id);
CREATE INDEX IF NOT EXISTS idx_commits_committed_at ON commits(committed_at);
CREATE INDEX IF NOT EXISTS idx_commits_branch       ON commits(branch);

CREATE TABLE IF NOT EXISTS daily_summary (
    id            SERIAL PRIMARY KEY,
    repo_id       INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date          DATE NOT NULL,
    commit_count  INTEGER DEFAULT 0,
    lines_added   INTEGER DEFAULT 0,
    lines_removed INTEGER DEFAULT 0,
    files_changed INTEGER DEFAULT 0,
    active_hours  INTEGER[],
    branches      TEXT[],

    UNIQUE(repo_id, date, user_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_summary(date);
CREATE INDEX IF NOT EXISTS idx_daily_summary_user ON daily_summary(user_id);

CREATE TABLE IF NOT EXISTS sync_log (
    id            SERIAL PRIMARY KEY,
    repo_id       INTEGER REFERENCES repositories(id) ON DELETE SET NULL,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    synced_at     TIMESTAMP DEFAULT NOW(),
    commits_added INTEGER DEFAULT 0,
    status        VARCHAR(50),
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS language_stats (
    id            SERIAL PRIMARY KEY,
    repo_id       INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date          DATE NOT NULL,
    language      VARCHAR(50) NOT NULL,
    lines_added   INTEGER DEFAULT 0,
    lines_removed INTEGER DEFAULT 0,
    UNIQUE(repo_id, date, language, user_id)
);

CREATE INDEX IF NOT EXISTS idx_language_stats_date ON language_stats(date);
CREATE INDEX IF NOT EXISTS idx_language_stats_repo ON language_stats(repo_id);
CREATE INDEX IF NOT EXISTS idx_language_stats_user ON language_stats(user_id);

CREATE TABLE coding_sessions (
    id              SERIAL PRIMARY KEY,
    repo_id         INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at      TIMESTAMP NOT NULL,
    ended_at        TIMESTAMP NOT NULL,
    duration_minutes INTEGER NOT NULL,
    commit_count    INTEGER DEFAULT 0,
    lines_added     INTEGER DEFAULT 0,
    lines_removed   INTEGER DEFAULT 0,
    branches        TEXT[],
    UNIQUE(user_id, started_at)
);

CREATE INDEX idx_sessions_repo ON coding_sessions(repo_id);
CREATE INDEX idx_sessions_user ON coding_sessions(user_id);
CREATE INDEX idx_sessions_started ON coding_sessions(started_at);