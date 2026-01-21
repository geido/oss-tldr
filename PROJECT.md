# OSS TL;DR - Database Migration Project

## Executive Summary

This document outlines the architectural decisions and implementation plan for migrating OSS TL;DR from a client-side localStorage solution to a persistent server-side database. The primary goals are:

1. **Multi-user persistence**: Store user preferences and tracked repositories server-side
2. **Intelligent report caching**: Share generated reports across users to reduce API calls and AI generation costs
3. **Improved performance**: Reduce redundant GitHub API and OpenAI calls
4. **Better user experience**: Access reports from any device, faster load times for cached reports

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Database Technology Decision](#database-technology-decision)
3. [Database Schema Design](#database-schema-design)
4. [Data Flow Architecture](#data-flow-architecture)
5. [Caching Strategy](#caching-strategy)
6. [Migration Strategy](#migration-strategy)
7. [Implementation Plan](#implementation-plan)
8. [Security Considerations](#security-considerations)
9. [Performance Optimization](#performance-optimization)
10. [Testing Strategy](#testing-strategy)

---

## Current State Analysis

### Existing Storage Mechanism

**Client-side only (localStorage)**:
- `oss_tldr_auth_token`: JWT token
- `oss_tldr_user`: User object
- `oss-tldr-repos:${userId}`: User's tracked repositories (max unspecified)
- `oss-tldr-reports:${userId}`: Generated TL;DR reports (max 50 per user)

### Current Data Entities

1. **User** (from GitHub OAuth):
   - `id` (GitHub ID), `login`, `name`, `email`, `avatar_url`

2. **Repository**:
   - `full_name`, `owner`, `name`, `description`, `html_url`, `private`, `language`, `stargazers_count`

3. **TL;DR Report**:
   - `repo`, `timeframe` ("last_day"|"last_week"|"last_month"|"last_year")
   - `prs[]`, `issues[]`, `people[]`, `tldr` (AI-generated summary)
   - `generatedAt`, `version`

4. **GitHub Items** (PRs/Issues):
   - `id`, `number`, `title`, `state`, `summary` (AI), `html_url`, `created_at`, `updated_at`
   - `comments`, `reactions`, `labels[]`, `user`, `assignees[]`

5. **People/Contributors**:
   - `username`, `avatar_url`, `profile_url`, `tldr` (AI)
   - `prs[]`, `issues[]`

### Current Limitations

1. **Data duplication**: If 100 users track the same repo, 100 identical reports are generated
2. **No cross-device sync**: Reports stored locally, not accessible from other devices
3. **Excessive API calls**: Every user regenerates the same data
4. **Cost inefficiency**: Redundant OpenAI API calls for identical content
5. **Storage limits**: Browser localStorage caps (5-10MB)
6. **No analytics**: Cannot track which repos are most popular

---

## Database Technology Decision

### SQL vs NoSQL Evaluation

| Criteria | SQL (PostgreSQL) | NoSQL (MongoDB) | Winner |
|----------|------------------|-----------------|--------|
| **Relational data** (users ↔ repos) | Excellent | Requires manual management | SQL |
| **De-duplication** (shared reports) | Natural via foreign keys | Manual logic required | SQL |
| **Complex queries** ("find users tracking repo X") | Native support | Aggregation pipelines | SQL |
| **Flexible schema** (varying report data) | JSONB provides flexibility | Native | Tie |
| **ACID guarantees** (report consistency) | Strong | Eventual consistency | SQL |
| **Horizontal scaling** | Vertical scaling preferred | Excellent | NoSQL |
| **Developer familiarity** | High | Medium | SQL |
| **Ecosystem maturity** (Python/FastAPI) | Excellent (SQLAlchemy, asyncpg) | Good (Motor) | SQL |

### Recommendation: **PostgreSQL**

**Rationale**:

1. **Strong relational structure**: Users and repositories have clear many-to-many relationships
2. **Report de-duplication**: Multiple users can reference the same report record
3. **JSONB support**: Flexible storage for PR/issue arrays while maintaining relational integrity
4. **Query efficiency**: Easily find existing reports by `(repository_id, timeframe, date_range)`
5. **ACID compliance**: Ensures report consistency when multiple users request simultaneously
6. **Excellent Python ecosystem**: SQLAlchemy ORM with async support via asyncpg
7. **Cost efficiency**: Better for read-heavy workloads with indexed queries

**PostgreSQL-specific advantages**:
- JSONB indexing (GIN/GiST) for querying nested report data
- Full-text search capabilities for future features
- Partitioning support for archiving old reports
- Window functions for analytics (top repos, trending repositories)

---

## Database Schema Design

### Entity Relationship Diagram

```
┌──────────────┐         ┌─────────────────────┐         ┌──────────────────┐
│    users     │◄───┐    │  user_repositories  │    ┌───►│  repositories    │
├──────────────┤    │    ├─────────────────────┤    │    ├──────────────────┤
│ id (PK)      │    └────│ user_id (FK)        │    │    │ id (PK)          │
│ login        │         │ repository_id (FK)  │────┘    │ full_name (UNIQUE)│
│ name         │         │ added_at            │         │ owner            │
│ email        │         └─────────────────────┘         │ name             │
│ avatar_url   │                                         │ description      │
│ created_at   │                                         │ html_url         │
│ updated_at   │         ┌─────────────────────┐         │ is_private       │
└──────────────┘         │ user_report_access  │         │ language         │
       │                 ├─────────────────────┤         │ stargazers_count │
       └────────────────►│ user_id (FK)        │         │ created_at       │
                         │ report_id (FK)      │         │ updated_at       │
                         │ accessed_at         │         └──────────────────┘
                         └─────────────────────┘                 │
                                    ▲                            │
                                    │                            ▼
                                    │                   ┌──────────────────┐
                                    └───────────────────│     reports      │
                                                        ├──────────────────┤
                                                        │ id (PK)          │
                                                        │ repository_id(FK)│
                                                        │ timeframe        │
                                                        │ timeframe_start  │
                                                        │ timeframe_end    │
                                                        │ tldr_text        │
                                                        │ prs (JSONB)      │
                                                        │ issues (JSONB)   │
                                                        │ people (JSONB)   │
                                                        │ generated_at     │
                                                        │ expires_at       │
                                                        │ version          │
                                                        └──────────────────┘
```

### SQL Schema Definition

```sql
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
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    timeframe VARCHAR(20) NOT NULL,           -- "last_day", "last_week", "last_month", "last_year"
    timeframe_start TIMESTAMP WITH TIME ZONE NOT NULL,  -- Actual start date
    timeframe_end TIMESTAMP WITH TIME ZONE NOT NULL,    -- Actual end date

    -- AI-generated content
    tldr_text TEXT,                           -- Repository summary
    prs JSONB,                                -- Array of PR objects with summaries
    issues JSONB,                             -- Array of issue objects with summaries
    people JSONB,                             -- Array of contributor objects with summaries

    -- Metadata
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,      -- Cache expiration (NULL = never expires)
    version INTEGER DEFAULT 1,                -- Schema version for migrations

    -- Ensure one report per (repo, timeframe, date_range) combination
    UNIQUE(repository_id, timeframe, timeframe_start, timeframe_end)
);

CREATE INDEX idx_reports_repository_id ON reports(repository_id);
CREATE INDEX idx_reports_timeframe ON reports(timeframe);
CREATE INDEX idx_reports_expires_at ON reports(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_reports_generated_at ON reports(generated_at);

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
```

### Schema Design Decisions

#### 1. Users Table
- **`id` as GitHub ID**: Immutable, prevents issues with username changes
- **`login` indexed**: Fast lookups by username
- **Nullable fields**: GitHub API may not always provide name/email

#### 2. Repositories Table
- **`full_name` unique**: Primary business identifier ("owner/repo")
- **Cached metadata**: Reduces GitHub API calls for repo info
- **`github_updated_at`**: Track when repo was last updated on GitHub
- **Soft references**: Not FK to users to allow tracking repos from other owners

#### 3. User-Repositories Junction Table
- **Many-to-many**: Users can track multiple repos, repos can be tracked by multiple users
- **`added_at`**: Track when user started following a repo
- **Cascade deletion**: If user deleted, remove their tracked repos

#### 4. Reports Table
- **Composite uniqueness**: `(repository_id, timeframe, timeframe_start, timeframe_end)`
  - Prevents duplicate reports for same repo/timeframe/date range
  - Multiple reports for same repo/timeframe allowed if date ranges differ (rolling window)
- **JSONB fields**: Flexible storage for arrays of PRs, issues, contributors
  - Allows schema evolution without migrations
  - Supports complex queries with GIN indexes
- **`expires_at`**: Configurable cache expiration
  - `NULL` = never expires
  - Set to `generated_at + N hours/days` for automatic expiration
- **`version`**: Schema versioning for future data migrations

#### 5. User-Report-Access Table
- **Track usage**: Analytics on which reports are popular
- **Personalization**: Show users their recently viewed reports
- **Optional**: Can be omitted in initial implementation

---

## Data Flow Architecture

### Report Generation Flow (With Caching)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          User Request                                   │
│                  POST /api/v1/generate-report                          │
│                  {repo_url, timeframe}                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    1. Parse and Validate Request                       │
│   - Extract owner/repo from URL                                        │
│   - Validate timeframe parameter                                       │
│   - Calculate timeframe_start and timeframe_end                        │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    2. Check Database for Cached Report                 │
│   SELECT * FROM reports r                                              │
│   JOIN repositories repo ON r.repository_id = repo.id                  │
│   WHERE repo.full_name = 'owner/repo'                                  │
│     AND r.timeframe = 'last_week'                                      │
│     AND r.timeframe_start = calculated_start                           │
│     AND r.timeframe_end = calculated_end                               │
│     AND (r.expires_at IS NULL OR r.expires_at > NOW())                 │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
              Cache Hit                    Cache Miss
                    │                           │
                    ▼                           ▼
┌──────────────────────────────┐  ┌────────────────────────────────────┐
│  3a. Return Cached Report    │  │  3b. Generate New Report           │
│  - Fetch from database       │  │  - Call GitHub API (PRs, issues)   │
│  - Record access in          │  │  - Call OpenAI (summaries)         │
│    user_report_access        │  │  - Generate TL;DR                  │
│  - Return to user            │  │                                    │
└──────────────────────────────┘  └────────────────────────────────────┘
                                                │
                                                ▼
                                  ┌────────────────────────────────────┐
                                  │  4. Save Report to Database        │
                                  │  - Upsert repository record        │
                                  │  - Insert report record            │
                                  │  - Record user access              │
                                  │  - Return to user                  │
                                  └────────────────────────────────────┘
```

### Key Flow Details

1. **Cache Key**: `(repository_id, timeframe, timeframe_start, timeframe_end)`
2. **Cache Hit Criteria**:
   - Exact match on repo + timeframe + date range
   - Report not expired (`expires_at` > NOW() or NULL)
3. **Cache Miss Handling**:
   - Generate report from scratch (existing logic)
   - Store in database with calculated expiration
4. **Concurrency Handling**:
   - Use database UNIQUE constraint to prevent duplicate generation
   - If simultaneous requests, second one waits/retries after INSERT conflict

---

## Caching Strategy

### Cache Expiration Policy

| Timeframe | Cache Duration | Rationale |
|-----------|----------------|-----------|
| `last_day` | 1 hour | High volatility, recent activity changes frequently |
| `last_week` | 6 hours | Moderate volatility, balance freshness vs. cost |
| `last_month` | 24 hours | Lower volatility, month-old data changes slowly |
| `last_year` | 7 days | Very stable, historical data rarely changes |

**Implementation**:
```python
CACHE_EXPIRATION = {
    "last_day": timedelta(hours=1),
    "last_week": timedelta(hours=6),
    "last_month": timedelta(days=1),
    "last_year": timedelta(days=7),
}

expires_at = datetime.utcnow() + CACHE_EXPIRATION[timeframe]
```

### Cache Invalidation Strategy

1. **Time-based expiration** (primary):
   - Set `expires_at` based on timeframe
   - Automated cleanup via scheduled job (delete expired reports)

2. **Manual invalidation** (optional):
   - Admin endpoint: `DELETE /api/v1/reports/{report_id}`
   - Invalidate all reports for a repo: `DELETE /api/v1/reports?repo=owner/repo`

3. **Smart invalidation** (future):
   - GitHub webhooks notify of new PRs/issues → invalidate cache
   - Requires webhook setup (out of scope for initial implementation)

### Cache Warming Strategy

**Problem**: First user to request a report waits for full generation.

**Solution** (optional, phase 2):
- Background job to pre-generate reports for popular repos
- Identify popular repos via `user_repositories` join count
- Schedule generation during off-peak hours

---

## Migration Strategy

### Phase 1: Database Setup (No Code Changes)

**Goal**: Set up database infrastructure without modifying application code.

**Tasks**:
1. Provision PostgreSQL instance (local or cloud)
2. Run schema creation SQL
3. Set up database connection pooling
4. Configure environment variables

**Deliverables**:
- Database instance running
- Schema deployed
- Connection tested

---

### Phase 2: Backend Integration (Read/Write Reports)

**Goal**: Implement database operations in backend, parallel to localStorage.

**Tasks**:
1. **ORM Setup**:
   - Install SQLAlchemy + asyncpg
   - Create ORM models matching schema
   - Set up database session management

2. **CRUD Operations**:
   - `get_or_create_user(github_user)` → upsert user on login
   - `get_or_create_repository(repo_url)` → upsert repository
   - `get_cached_report(repo, timeframe, start, end)` → query reports
   - `save_report(repo, timeframe, data)` → insert/update report
   - `track_repository(user, repo)` → add to user_repositories
   - `get_user_repositories(user)` → fetch tracked repos

3. **Cache Integration**:
   - Modify `/api/v1/generate-report` (or create new endpoint) to check cache first
   - Fall back to existing generation logic on cache miss
   - Store result in database after generation

4. **User Sync on Login**:
   - On `/auth/github/callback`, upsert user to database
   - Fetch user's tracked repos from database

**Deliverables**:
- Working database CRUD layer
- Reports stored and retrieved from database
- No breaking changes to frontend

---

### Phase 3: Frontend Migration (Remove localStorage)

**Goal**: Transition frontend to fetch reports from backend API instead of localStorage.

**Tasks**:
1. **API Client Updates**:
   - Modify `useTLDRData` to call new `/api/v1/reports` endpoint
   - Remove localStorage reads/writes for reports
   - Keep auth token in localStorage (unchanged)

2. **Repository Tracking**:
   - Add API endpoints:
     - `POST /api/v1/users/me/repositories` → track repo
     - `GET /api/v1/users/me/repositories` → list tracked repos
     - `DELETE /api/v1/users/me/repositories/{id}` → untrack repo
   - Update `DashboardView` to use API instead of localStorage

3. **Migration Script**:
   - Provide script to import existing localStorage reports to database
   - Optional: auto-migrate on first login post-deployment

**Deliverables**:
- Frontend completely database-backed
- localStorage only for auth tokens
- Migration script for existing users

---

### Phase 4: Optimization & Monitoring

**Goal**: Optimize performance and add observability.

**Tasks**:
1. **Query Optimization**:
   - Add database query logging
   - Identify slow queries
   - Add missing indexes

2. **Analytics**:
   - Track report cache hit rate
   - Identify most popular repositories
   - Monitor database size growth

3. **Cleanup Jobs**:
   - Scheduled job to delete expired reports
   - Archive old reports (optional)

**Deliverables**:
- Optimized query performance
- Monitoring dashboards
- Automated cleanup

---

## Implementation Plan

### File Structure Changes

```
backend/
├── database/
│   ├── __init__.py
│   ├── connection.py           # Database connection setup
│   ├── models.py                # SQLAlchemy ORM models
│   └── migrations/              # Alembic migrations
│       ├── env.py
│       └── versions/
│           └── 001_initial_schema.py
│
├── repositories/                 # Data access layer (repository pattern)
│   ├── __init__.py
│   ├── base.py                  # Base repository class
│   ├── users.py                 # User CRUD operations
│   ├── repositories.py          # Repository CRUD operations
│   ├── reports.py               # Report CRUD operations
│   └── user_repositories.py     # User-repo tracking
│
├── api/
│   ├── reports.py               # NEW: Report endpoints
│   ├── user_repos.py            # NEW: User repository tracking endpoints
│   └── (existing files...)
│
└── config.py                     # Add DATABASE_URL
```

### Dependencies to Add

```toml
# pyproject.toml
[tool.poetry.dependencies]
sqlalchemy = "^2.0.0"           # ORM
asyncpg = "^0.29.0"             # Async PostgreSQL driver
alembic = "^1.13.0"             # Database migrations
```

### Environment Variables

```bash
# backend/.env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/oss_tldr

# Optional tuning
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30
```

### New API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/reports/generate` | Generate or retrieve cached report |
| `GET` | `/api/v1/reports` | List all reports (admin/analytics) |
| `DELETE` | `/api/v1/reports/{id}` | Invalidate specific report |
| `GET` | `/api/v1/users/me/repositories` | List user's tracked repos |
| `POST` | `/api/v1/users/me/repositories` | Track a new repository |
| `DELETE` | `/api/v1/users/me/repositories/{id}` | Untrack repository |
| `GET` | `/api/v1/users/me/reports` | List reports accessed by user |

### Database Migration Commands

```bash
# Initialize Alembic
cd backend
alembic init database/migrations

# Create initial migration
alembic revision --autogenerate -m "Initial schema"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

---

## Security Considerations

### Data Privacy

1. **User Isolation**:
   - Reports are shared, but access is tracked in `user_report_access`
   - Users can only see reports for repos they have GitHub access to
   - Verify user access via GitHub API before serving cached reports

2. **Private Repository Handling**:
   - Check `repositories.is_private` flag
   - Validate user's GitHub token has access to private repo
   - Never serve private repo reports to unauthorized users

3. **Data Encryption**:
   - Use TLS for database connections
   - GitHub tokens remain encrypted in JWT (unchanged)
   - Consider encrypting JSONB fields if storing sensitive data

### Access Control

```python
# Pseudo-code for report access check
async def get_report(user: User, repo_name: str, timeframe: str):
    # 1. Fetch repository from database
    repo = await repositories_repo.get_by_full_name(repo_name)

    # 2. If repo is private, verify user has access via GitHub API
    if repo.is_private:
        has_access = await github_client.check_repo_access(user.github_token, repo_name)
        if not has_access:
            raise HTTPException(403, "No access to private repository")

    # 3. Fetch cached report
    report = await reports_repo.get_cached_report(repo.id, timeframe, start, end)

    # 4. Track user access
    await user_report_access_repo.record_access(user.id, report.id)

    return report
```

### SQL Injection Prevention

- Use SQLAlchemy ORM (automatic parameterization)
- Never construct raw SQL with f-strings
- Validate all user inputs

---

## Performance Optimization

### Database Indexing Strategy

**Critical Indexes** (already in schema):
1. `idx_reports_repository_id` → Fast lookups by repo
2. `idx_reports_timeframe` → Filter by timeframe
3. `idx_reports_expires_at` → Cleanup job efficiency
4. `idx_repositories_full_name` → Repo lookups by "owner/repo"
5. `idx_user_repositories_user_id` → User's tracked repos

**Optional Indexes** (add if slow):
- Composite index: `(repository_id, timeframe, timeframe_start, timeframe_end)` → cache hit queries
- GIN indexes on JSONB fields → search within report data

### Query Optimization

1. **N+1 Query Prevention**:
   - Use SQLAlchemy `joinedload()` for eager loading
   - Example: Load user + tracked repos in single query

2. **Pagination**:
   - Limit results with `LIMIT`/`OFFSET`
   - Add pagination to `/api/v1/reports` endpoint

3. **Connection Pooling**:
   - Configure asyncpg pool size based on load
   - Default: `pool_size=20, max_overflow=10`

### Caching Layers

**Database Query Cache**:
- Use Redis for frequently accessed data (future enhancement)
- Cache repository metadata lookups
- Cache user repository lists

**Application-Level Cache**:
- Cache parsed timeframe date ranges (avoid recalculating)
- Memoize user permission checks

---

## Testing Strategy

### Unit Tests

**Database Models** (`tests/database/test_models.py`):
- Test ORM model creation
- Test relationships (users ↔ repos, reports ↔ repos)
- Test constraints (UNIQUE, FK)

**Repositories** (`tests/repositories/test_*.py`):
- Test CRUD operations
- Test upsert logic (get_or_create)
- Test query filters (cache lookup)

### Integration Tests

**API Endpoints** (`tests/api/test_reports.py`):
- Test report generation with cache miss
- Test report retrieval with cache hit
- Test concurrent request handling (race conditions)
- Test private repo access control

**Database Migrations** (`tests/database/test_migrations.py`):
- Test migration up/down
- Test schema integrity after migration

### Performance Tests

**Load Testing**:
- Simulate 100 concurrent users requesting same report
- Verify only 1 report generated (cache hit for others)
- Measure query response times

**Benchmarking**:
- Compare localStorage vs database response times
- Measure cache hit rate over time

---

## Rollback Plan

### Deployment Safety

**Dual-Write Phase** (optional):
- Write to both localStorage (frontend) and database (backend)
- Allows instant rollback without data loss
- Remove after 2 weeks of stable operation

**Feature Flag**:
```python
# config.py
USE_DATABASE_REPORTS = os.getenv("USE_DATABASE_REPORTS", "true").lower() == "true"

# In API endpoint
if USE_DATABASE_REPORTS:
    report = await get_from_database(...)
else:
    report = generate_fresh(...)  # Old behavior
```

### Rollback Steps

If issues arise post-deployment:

1. **Immediate**: Set `USE_DATABASE_REPORTS=false` → reverts to localStorage
2. **Database Issues**: Restore database from backup
3. **Schema Issues**: Run `alembic downgrade -1`
4. **Data Corruption**: Restore from last known good backup

---

## Cost Analysis

### Database Hosting Costs

**Estimated Data Size**:
- Users: 100 bytes/user × 10,000 users = 1 MB
- Repositories: 500 bytes/repo × 5,000 repos = 2.5 MB
- Reports: 50 KB/report × 10,000 reports = 500 MB
- **Total: ~500 MB** (initial), growing ~100 MB/month

**PostgreSQL Hosting Options**:
- **Railway/Render**: $5-10/month (512 MB - 1 GB storage)
- **Heroku Postgres**: $5/month (Hobby tier, 10k rows)
- **AWS RDS**: $15-25/month (db.t3.micro)
- **Supabase**: Free tier (500 MB), then $25/month

**Recommendation**: Start with Railway/Render ($5/month), migrate to AWS RDS if scaling needed.

### Cost Savings

**GitHub API Rate Limits**:
- Current: 5,000 requests/hour/user
- With caching: Reduce by ~80% (cache hit rate)
- Fewer rate limit errors

**OpenAI API Costs**:
- Current: ~$0.01/report (gpt-4o-mini)
- 100 users × 10 reports/day × 30 days = 30,000 reports/month
- **Without caching**: $300/month
- **With caching (80% hit rate)**: $60/month
- **Savings**: $240/month

**ROI**: Database costs ($5/month) << API savings ($240/month)

---

## Timeline Estimate

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| **Phase 1** | Database setup, schema creation | 1 day |
| **Phase 2** | ORM models, CRUD layer, cache integration | 3-5 days |
| **Phase 3** | Frontend migration, API updates | 2-3 days |
| **Phase 4** | Testing, optimization, monitoring | 2-3 days |
| **Total** | End-to-end implementation | **8-12 days** |

*Timeline assumes 1 full-time engineer with database + FastAPI experience.*

---

## Success Metrics

### Key Performance Indicators (KPIs)

1. **Cache Hit Rate**: Target >70% within 1 month
2. **API Cost Reduction**: Target >60% reduction in OpenAI costs
3. **Response Time**: Cache hits <200ms, cache misses <5s (unchanged)
4. **Database Size Growth**: <500 MB/month
5. **User Satisfaction**: No increase in report generation errors

### Monitoring

**Database Metrics**:
- Query duration (p50, p95, p99)
- Connection pool utilization
- Disk usage growth rate

**Application Metrics**:
- Cache hit/miss ratio
- Report generation time
- API error rate

**Cost Metrics**:
- OpenAI API spend per month
- GitHub API requests per hour
- Database hosting costs

---

## Future Enhancements

### Phase 5+ (Post-MVP)

1. **Analytics Dashboard**:
   - Most popular repositories
   - Trending topics (from report summaries)
   - User engagement metrics

2. **Report Sharing**:
   - Public URLs for reports
   - Embed reports on external sites

3. **Scheduled Reports**:
   - Email weekly summaries for tracked repos
   - Slack/Discord notifications for new PRs/issues

4. **Advanced Caching**:
   - GitHub webhook integration for smart invalidation
   - Partial report updates (only new PRs since last generation)

5. **Offline Support**:
   - Progressive Web App (PWA) with service workers
   - Sync reports to IndexedDB for offline viewing

6. **Team Features**:
   - Organizations/teams can share tracked repos
   - Team-wide analytics and insights

---

## Appendix

### A. Example ORM Models (SQLAlchemy)

```python
# backend/database/models.py
from sqlalchemy import Column, Integer, BigInteger, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.connection import Base

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True)
    login = Column(String(255), nullable=False, index=True)
    name = Column(String(255))
    email = Column(String(255))
    avatar_url = Column(String(512))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    tracked_repos = relationship("UserRepository", back_populates="user", cascade="all, delete-orphan")
    accessed_reports = relationship("UserReportAccess", back_populates="user", cascade="all, delete-orphan")

class Repository(Base):
    __tablename__ = "repositories"

    id = Column(Integer, primary_key=True)
    full_name = Column(String(255), unique=True, nullable=False, index=True)
    owner = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    html_url = Column(String(512), nullable=False)
    is_private = Column(Boolean, default=False)
    is_fork = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    language = Column(String(100))
    stargazers_count = Column(Integer, default=0)
    github_updated_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    reports = relationship("Report", back_populates="repository", cascade="all, delete-orphan")
    tracked_by = relationship("UserRepository", back_populates="repository", cascade="all, delete-orphan")

class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (
        UniqueConstraint('repository_id', 'timeframe', 'timeframe_start', 'timeframe_end'),
    )

    id = Column(Integer, primary_key=True)
    repository_id = Column(Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    timeframe = Column(String(20), nullable=False)
    timeframe_start = Column(DateTime(timezone=True), nullable=False)
    timeframe_end = Column(DateTime(timezone=True), nullable=False)
    tldr_text = Column(Text)
    prs = Column(JSONB)
    issues = Column(JSONB)
    people = Column(JSONB)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))
    version = Column(Integer, default=1)

    # Relationships
    repository = relationship("Repository", back_populates="reports")
    accessed_by = relationship("UserReportAccess", back_populates="report", cascade="all, delete-orphan")

class UserRepository(Base):
    __tablename__ = "user_repositories"
    __table_args__ = (
        UniqueConstraint('user_id', 'repository_id'),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    repository_id = Column(Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="tracked_repos")
    repository = relationship("Repository", back_populates="tracked_by")

class UserReportAccess(Base):
    __tablename__ = "user_report_access"
    __table_args__ = (
        UniqueConstraint('user_id', 'report_id'),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    report_id = Column(Integer, ForeignKey("reports.id", ondelete="CASCADE"), nullable=False)
    accessed_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="accessed_reports")
    report = relationship("Report", back_populates="accessed_by")
```

### B. Example Repository Pattern

```python
# backend/repositories/reports.py
from typing import Optional
from datetime import datetime
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from database.models import Report, Repository

class ReportsRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_cached_report(
        self,
        repository_id: int,
        timeframe: str,
        start: datetime,
        end: datetime
    ) -> Optional[Report]:
        """Find cached report if exists and not expired."""
        query = select(Report).where(
            and_(
                Report.repository_id == repository_id,
                Report.timeframe == timeframe,
                Report.timeframe_start == start,
                Report.timeframe_end == end,
                or_(
                    Report.expires_at.is_(None),
                    Report.expires_at > datetime.utcnow()
                )
            )
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def create_report(
        self,
        repository_id: int,
        timeframe: str,
        start: datetime,
        end: datetime,
        data: dict,
        expires_at: Optional[datetime] = None
    ) -> Report:
        """Create new report."""
        report = Report(
            repository_id=repository_id,
            timeframe=timeframe,
            timeframe_start=start,
            timeframe_end=end,
            tldr_text=data.get("tldr"),
            prs=data.get("prs"),
            issues=data.get("issues"),
            people=data.get("people"),
            expires_at=expires_at,
        )
        self.session.add(report)
        await self.session.commit()
        await self.session.refresh(report)
        return report
```

### C. Docker Compose for Local Development

```yaml
# docker-compose.yml (add PostgreSQL service)
version: '3.8'

services:
  # ... existing services ...

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: oss_tldr
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: oss_tldr
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U oss_tldr"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### D. Alembic Configuration

```python
# backend/database/migrations/env.py
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
from database.models import Base
from config import DATABASE_URL

config = context.config
config.set_main_option("sqlalchemy.url", DATABASE_URL)

fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

run_migrations_online()
```

---

## Conclusion

This migration from localStorage to PostgreSQL provides:

1. **✅ Multi-user persistence**: Server-side storage accessible from any device
2. **✅ Intelligent caching**: Share reports across users, reduce API costs by 80%
3. **✅ Scalability**: Database can handle millions of reports
4. **✅ Analytics**: Track popular repos, user engagement
5. **✅ Cost efficiency**: Save $240/month on OpenAI API calls

**Next Steps**:
1. Review and approve this document
2. Provision PostgreSQL instance
3. Begin Phase 1 implementation (database setup)
4. Iteratively implement Phases 2-4
5. Monitor metrics and optimize

**Questions or Concerns**: Please reach out to the engineering team for clarification on any aspect of this design.
