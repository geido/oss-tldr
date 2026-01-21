-- Users table (synchronized with GitHub OAuth)
CREATE TABLE users (
    id BIGINT PRIMARY KEY,              -- GitHub user ID (immutable)
    login VARCHAR(255) NOT NULL,        -- GitHub username
    name VARCHAR(255),                  -- Display name (can be null)
    email VARCHAR(255),                 -- Email (can be null if not public)
    avatar_url VARCHAR(512),            -- GitHub avatar URL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_login ON users(login);

-- Repositories table (cached GitHub repository metadata)
CREATE TABLE repositories (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL UNIQUE,   -- "owner/repo" (unique identifier)
    owner VARCHAR(255) NOT NULL,              -- Repository owner username/org
    name VARCHAR(255) NOT NULL,               -- Repository name
    description TEXT,                         -- Repository description
    html_url VARCHAR(512) NOT NULL,           -- GitHub repository URL
    is_private BOOLEAN DEFAULT FALSE,         -- Privacy status
    is_fork BOOLEAN DEFAULT FALSE,            -- Fork status
    is_archived BOOLEAN DEFAULT FALSE,        -- Archive status
    language VARCHAR(100),                    -- Primary programming language
    stargazers_count INTEGER DEFAULT 0,       -- Star count (cached)
    github_updated_at TIMESTAMP WITH TIME ZONE,  -- Last update on GitHub
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_repositories_full_name ON repositories(full_name);
CREATE INDEX idx_repositories_owner ON repositories(owner);

-- User-Repository tracking (many-to-many relationship)
CREATE TABLE user_repositories (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, repository_id)
);

CREATE INDEX idx_user_repositories_user_id ON user_repositories(user_id);
CREATE INDEX idx_user_repositories_repository_id ON user_repositories(repository_id);

-- TL;DR Reports (shared across users)
-- Uses deterministic timeframes (day boundaries) so data never expires
-- Once generated for a specific date range, it's cached permanently
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    timeframe VARCHAR(20) NOT NULL,           -- "last_day", "last_week", "last_month", "last_year"
    timeframe_start TIMESTAMP WITH TIME ZONE NOT NULL,  -- Actual start date (day boundary)
    timeframe_end TIMESTAMP WITH TIME ZONE NOT NULL,    -- Actual end date (day boundary)

    -- Section data (loaded progressively, cached independently)
    prs JSONB,                                -- Array of PR objects with summaries
    prs_generated_at TIMESTAMP WITH TIME ZONE,

    issues JSONB,                             -- Array of issue objects with summaries
    issues_generated_at TIMESTAMP WITH TIME ZONE,

    people JSONB,                             -- Array of contributor objects with summaries
    people_generated_at TIMESTAMP WITH TIME ZONE,

    -- TL;DR summary (cached with 1-hour expiration like other sections)
    tldr_text TEXT,
    tldr_generated_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 2,                -- Schema version 2 = section-level caching

    -- Ensure one report per (repo, timeframe, date_range) combination
    UNIQUE(repository_id, timeframe, timeframe_start, timeframe_end)
);

CREATE INDEX idx_reports_repository_id ON reports(repository_id);
CREATE INDEX idx_reports_timeframe ON reports(timeframe);

-- GIN index for JSONB queries (optional, for future features)
CREATE INDEX idx_reports_prs_gin ON reports USING GIN(prs);
CREATE INDEX idx_reports_issues_gin ON reports USING GIN(issues);

-- User-Report Access tracking (which users have viewed which reports)
CREATE TABLE user_report_access (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, report_id)
);

CREATE INDEX idx_user_report_access_user_id ON user_report_access(user_id);
CREATE INDEX idx_user_report_access_report_id ON user_report_access(report_id);

-- Trigger to update `updated_at` timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repositories_updated_at
    BEFORE UPDATE ON repositories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
