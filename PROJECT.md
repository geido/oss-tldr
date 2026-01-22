# OSS TL;DR - Database Architecture

## Executive Summary

This document describes the database architecture for OSS TL;DR, which uses PostgreSQL for persistent server-side storage. The architecture provides:

1. **Multi-user persistence**: User preferences, tracked repositories, and groups stored server-side
2. **Intelligent report caching**: Reports shared across users, permanently cached per timeframe
3. **Improved performance**: Drastically reduced GitHub API and OpenAI calls via caching
4. **Better user experience**: Access reports from any device, instant loading for cached reports

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Technology](#database-technology)
3. [Database Schema Design](#database-schema-design)
4. [Data Flow Architecture](#data-flow-architecture)
5. [Caching Strategy](#caching-strategy)
6. [Groups Feature](#groups-feature)
7. [Security Considerations](#security-considerations)
8. [Performance Optimization](#performance-optimization)

---

## Architecture Overview

### Storage Design

**Server-side (PostgreSQL)**:
- All user data, repositories, reports, and groups stored in database
- Reports cached permanently per (repository, timeframe, date_range)
- Shared across all users - same report served to everyone

**Client-side (localStorage)**:
- `oss_tldr_auth_token`: JWT token only
- `oss_tldr_user`: Basic user info for UI display

### Data Entities

1. **User** (from GitHub OAuth):
   - `id` (GitHub ID), `login`, `name`, `email`, `avatar_url`
   - Synced on each login

2. **Repository**:
   - `full_name`, `owner`, `name`, `description`, `html_url`, `is_private`, `language`, `stargazers_count`
   - Cached metadata from GitHub

3. **TL;DR Report** (Section-level caching):
   - `repository_id`, `timeframe`, `timeframe_start`, `timeframe_end`
   - `prs` (JSONB), `issues` (JSONB), `people` (JSONB), `tldr_text`
   - Each section cached independently with its own timestamp

4. **Group**:
   - `name`, `slug`, `description`, `is_system`, `created_by_id`
   - System groups seeded from YAML, user groups created via API

5. **GroupRepository** (Junction):
   - Links groups to repository identifiers
   - Supports ordered repository lists

### Key Benefits

1. **No data duplication**: One report per (repo, timeframe, date_range) shared by all users
2. **Cross-device access**: Reports accessible from any device after login
3. **Reduced API costs**: Cache hits avoid GitHub and OpenAI API calls
4. **Cost efficiency**: ~80% reduction in OpenAI costs via caching
5. **Unlimited storage**: No browser localStorage limits
6. **Analytics ready**: Can track popular repos, usage patterns

---

## Database Technology

### Why PostgreSQL?

| Feature | Benefit |
|---------|---------|
| **Relational data** | Natural modeling of users ↔ repos ↔ groups relationships |
| **JSONB columns** | Flexible storage for PR/issue arrays with indexing support |
| **ACID compliance** | Consistent reports when multiple users request simultaneously |
| **Async support** | Excellent Python ecosystem (SQLAlchemy + asyncpg) |
| **Report de-duplication** | Foreign keys enable shared reports across users |

### Key Design Decisions

1. **JSONB for report sections**: PRs, issues, people stored as JSONB arrays
   - Avoids complex joins for nested data
   - Supports GIN indexing for queries within arrays
   - Easy schema evolution without migrations

2. **Deterministic timeframes**: Reports keyed by exact date ranges
   - `last_week` on Oct 21 = Oct 14-20 (fixed, never changes)
   - Enables permanent caching - no expiration needed

3. **Section-level caching**: Each section (prs, issues, people, tldr) cached independently
   - Supports progressive loading architecture
   - Frontend can request sections in parallel

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
│ created_at   │         ┌─────────────────────┐         │ html_url         │
│ updated_at   │         │      groups         │         │ is_private       │
└──────────────┘         ├─────────────────────┤         │ language         │
       │                 │ id (PK)             │         │ stargazers_count │
       │                 │ name                │         └──────────────────┘
       │                 │ slug (UNIQUE)       │                 │
       │                 │ description         │                 │
       │                 │ is_system           │                 ▼
       │                 │ created_by_id (FK)──┼────►    ┌──────────────────┐
       │                 └─────────────────────┘         │     reports      │
       │                          │                      ├──────────────────┤
       │                          ▼                      │ id (PK)          │
       │                 ┌─────────────────────┐         │ repository_id(FK)│
       │                 │ group_repositories  │         │ timeframe        │
       │                 ├─────────────────────┤         │ timeframe_start  │
       │                 │ group_id (FK)       │         │ timeframe_end    │
       │                 │ repository_id       │         │ prs (JSONB)      │
       │                 │ position            │         │ issues (JSONB)   │
       │                 └─────────────────────┘         │ people (JSONB)   │
       │                                                 │ tldr_text        │
       │                 ┌─────────────────────┐         │ version          │
       └────────────────►│ user_report_access  │         └──────────────────┘
                         ├─────────────────────┤                 ▲
                         │ user_id (FK)        │                 │
                         │ report_id (FK)      │─────────────────┘
                         │ accessed_at         │
                         └─────────────────────┘
```

### Core Tables

**See `backend/database/schema.sql` for the complete schema definition.**

Key tables:
- **users**: GitHub user info (synced on login)
- **repositories**: Cached GitHub repo metadata
- **user_repositories**: User ↔ Repository tracking (many-to-many)
- **reports**: Cached TL;DR reports with section-level data (JSONB)
- **user_report_access**: Tracks which users accessed which reports
- **groups**: Repository groups (system + user-created)
- **group_repositories**: Group ↔ Repository mapping with ordering

### Schema Design Decisions

1. **Users**: `id` is GitHub ID (immutable), prevents issues with username changes
2. **Repositories**: `full_name` unique key ("owner/repo"), cached GitHub metadata
3. **Reports**: Composite unique on `(repository_id, timeframe, timeframe_start, timeframe_end)`
4. **Groups**: `is_system` flag distinguishes system vs user-created groups
5. **JSONB fields**: Flexible storage for PRs, issues, people arrays

---

## Data Flow Architecture

### Progressive Report Loading

```
Frontend fires parallel requests:
  → GET /reports/{owner}/{repo}/prs?timeframe=X
  → GET /reports/{owner}/{repo}/issues?timeframe=X
  → GET /reports/{owner}/{repo}/people?timeframe=X
  → GET /reports/{owner}/{repo}/tldr?timeframe=X

Each endpoint:
  1. Calculate deterministic date range from timeframe
  2. Check database for cached section
  3. Return cached data if exists (instant response)
  4. Generate fresh data if missing
  5. Store in database for future requests
  6. Return data to frontend
```

### Cache Key

`(repository_id, timeframe, timeframe_start, timeframe_end)`

- **Deterministic**: `last_week` on Oct 21 always = Oct 14-20
- **Permanent**: Once generated, data never expires
- **Shared**: All users get same cached data

---

## Caching Strategy

### Permanent Caching

Reports are cached **permanently** because timeframes are deterministic:
- `last_day` = Yesterday (fixed dates)
- `last_week` = Last 7 complete days
- `last_month` = Last 30 complete days
- `last_year` = Last 365 complete days

Once data for a specific date range is generated, it never changes.

### Force Refresh

Users can force regeneration via `?force=true` query parameter:
```
GET /reports/{owner}/{repo}/prs?timeframe=last_week&force=true
```

---

## Groups Feature

### System Groups

- Predefined in `backend/groups/*.yaml`
- Seeded to database on application startup via `utils/group_config.py`
- Cannot be modified or deleted by users
- Shared across all users

### User Groups

- Created via `POST /api/v1/groups`
- Stored in database with `is_system=false`
- CRUD operations: create, read, update, delete
- Owned by creating user (enforced via `created_by_id`)

### Group Reports

- Aggregated TL;DR across multiple repositories
- Generated via `POST /api/v1/groups/report`
- Supports both saved groups and ad-hoc repository lists

---

## Security Considerations

### Data Privacy

1. **Report sharing**: Reports are shared, but only for accessible repositories
2. **Private repos**: User's GitHub token validates access before serving
3. **User groups**: Users can only see/modify their own groups
4. **System groups**: Read-only for all users

### Access Control

- JWT tokens validated on every request
- GitHub token embedded in JWT for API access validation
- User ID extracted from JWT for ownership checks

---

## Performance Optimization

### Database Indexing

Key indexes (defined in `schema.sql`):
- `idx_repositories_full_name` - Fast repo lookups
- `idx_reports_repository_id` - Report queries by repo
- Composite unique constraints prevent duplicate data

### Connection Pooling

Configured via environment variables:
- `DB_POOL_SIZE=20` - Base pool size
- `DB_MAX_OVERFLOW=10` - Additional connections under load
- `DB_POOL_TIMEOUT=30` - Wait time for connection

### Query Optimization

- SQLAlchemy async sessions with `asyncpg` driver
- Eager loading via `selectinload()` for relationships
- JSONB queries avoid N+1 problems for nested data
