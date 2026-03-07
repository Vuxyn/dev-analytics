CREATE TABLE IF NOT EXISTS repositories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    path TEXT NOT NULL UNIQUE,
    remote_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    last_synced TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commits (
    id            SERIAL PRIMARY KEY,
    repo_id       INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    sha           VARCHAR(40) NOT NULL UNIQUE,
    branch        VARCHAR(255) NOT NULL,
    author_name   VARCHAR(255),
    author_email  VARCHAR(255),
    message       TEXT,
    lines_added   INTEGER DEFAULT 0,
    lines_removed INTEGER DEFAULT 0,
    files_changed INTEGER DEFAULT 0,
    committed_at  TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_commits_repo_id      ON commits(repo_id);
CREATE INDEX IF NOT EXISTS idx_commits_committed_at ON commits(committed_at);
CREATE INDEX IF NOT EXISTS idx_commits_branch       ON commits(branch);

CREATE TABLE IF NOT EXISTS daily_summary (
    id            SERIAL PRIMARY KEY,
    repo_id       INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    date          DATE NOT NULL,
    commit_count  INTEGER DEFAULT 0,
    lines_added   INTEGER DEFAULT 0,
    lines_removed INTEGER DEFAULT 0,
    files_changed INTEGER DEFAULT 0,
    active_hours  INTEGER[],
    branches      TEXT[],

    UNIQUE(repo_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_summary(date);

CREATE TABLE IF NOT EXISTS sync_log (
    id            SERIAL PRIMARY KEY,
    repo_id       INTEGER REFERENCES repositories(id) ON DELETE SET NULL,
    synced_at     TIMESTAMP DEFAULT NOW(),
    commits_added INTEGER DEFAULT 0,
    status        VARCHAR(50),
    error_message TEXT
);
