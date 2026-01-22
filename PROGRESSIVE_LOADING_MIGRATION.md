# Progressive Loading Migration Guide

## Overview

This migration restores progressive loading UX while maintaining all database caching improvements. Users now see results as they become available instead of waiting for a monolithic response.

## What Changed

### Architecture: Before vs. After

**Before (Broken):**
```
Frontend → POST /reports/generate
           ↓ (waits for everything)
           ← Returns entire report (PRs + Issues + People + TL;DR)
```

**After (Fixed):**
```
Frontend fires parallel requests:
  → GET /reports/{owner}/{repo}/prs?timeframe=X
  → GET /reports/{owner}/{repo}/issues?timeframe=X
  → GET /reports/{owner}/{repo}/people?timeframe=X
  → POST /tldr (after prs+issues complete)

Each section:
  1. Checks database cache
  2. Returns immediately if cached (instant!)
  3. Generates fresh data if needed
  4. Stores in database for next request
```

## Changes Made

### 1. Database Schema (`backend/database/models.py`)

Updated `Report` model with section-level caching:

```python
# Before: Single timestamp for entire report
generated_at = Column(DateTime)
expires_at = Column(DateTime)

# After: Individual timestamps per section
prs_generated_at = Column(DateTime)
prs_expires_at = Column(DateTime)
issues_generated_at = Column(DateTime)
issues_expires_at = Column(DateTime)
people_generated_at = Column(DateTime)
people_expires_at = Column(DateTime)
```

**Migration Required:** Run `backend/migrations/001_add_section_level_caching.sql`

### 2. Repository Pattern (`backend/repositories/reports.py`)

New methods for section-level operations:
- `get_or_create_report_record()` - Creates base report record
- `get_cached_section()` - Retrieves cached section if valid
- `update_section()` - Updates specific section with data + timestamps

### 3. Backend API (`backend/api/reports.py`)

**Replaced** monolithic endpoint with progressive endpoints:

```python
# Old (removed):
POST /reports/generate → returns entire report

# New (progressive):
GET /reports/{owner}/{repo}/prs?timeframe=X
GET /reports/{owner}/{repo}/issues?timeframe=X
GET /reports/{owner}/{repo}/people?timeframe=X
```

Each endpoint:
- Checks cache first
- Returns cached data if valid (instant response)
- Generates fresh if expired/missing
- Stores result in database

### 4. Frontend Hook (`frontend/src/hooks/useTLDRData.ts`)

Restored progressive loading orchestration:

```typescript
// Fire 3 parallel requests
const peoplePromise = apiClient.getReportSection(owner, repo, "people", timeframe)
const prsPromise = apiClient.getReportSection(owner, repo, "prs", timeframe)
const issuesPromise = apiClient.getReportSection(owner, repo, "issues", timeframe)

// Update UI as each completes
.then((data) => {
  setData((prev) => ({ ...prev, prs: data.prs })) // Progressive update!
})

// After PRs + Issues, stream TL;DR
await Promise.all([prsPromise, issuesPromise])
const tldrRes = await apiClient.postStream("tldr", { text: summaries })
```

**React.StrictMode Protection:**
- `requestInFlightRef` prevents duplicate requests
- `AbortController` for proper cleanup
- Request deduplication by `${repo}-${timeframe}` key

### 5. API Client (`frontend/src/utils/apiClient.ts`)

Added new method:

```typescript
async getReportSection(
  owner: string,
  repo: string,
  section: "prs" | "issues" | "people",
  timeframe: Timeframe,
  options?: RequestInit
): Promise<ReportSectionResponse>
```

### 6. Documentation (`CLAUDE.md` & `AGENTS.md`)

Added **CRITICAL UX PRINCIPLES** section at the top:
- Progressive loading is MANDATORY
- Never create monolithic report endpoints
- React.StrictMode double-request prevention patterns
- Database caching strategy

## Migration Steps

### 1. Database Migration

```bash
cd backend
psql $DATABASE_URL < migrations/001_add_section_level_caching.sql
```

This adds section-level timestamp columns and migrates existing data.

### 2. Verify Backend

```bash
cd backend
poetry install
python3 -m py_compile database/models.py
python3 -m py_compile repositories/reports.py
python3 -m py_compile api/reports.py
```

All should compile without errors.

### 3. Verify Frontend

```bash
cd frontend
npm install
npm run type  # TypeScript check
npm run build # Production build
```

### 4. Test Progressive Loading

1. Start backend: `cd backend && poetry run uvicorn main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Open browser, generate a report
4. Watch console logs:
   - **First request:** `✗ Cache MISS for org/repo PRs (last_week) - generating`
   - **Second request:** `✓ Cache HIT for org/repo PRs (last_week)`
5. Observe progressive loading:
   - PRs appear first
   - Issues appear second
   - People appear third
   - TL;DR streams last

## Benefits

### User Experience
- ✅ **Instant feedback** - sections load as ready
- ✅ **No blocking** - UI updates progressively
- ✅ **Cache benefits** - instant on cache hit
- ✅ **Parallel requests** - faster overall load

### Performance
- ✅ **Database caching** - shared across users
- ✅ **Section-level expiration** - fine-grained cache control
- ✅ **Reduced API calls** - cache hits save GitHub/OpenAI quota
- ✅ **Optimized people generation** - reuses cached PR/Issue data

### Developer Experience
- ✅ **Clear architecture** - documented in CLAUDE.md
- ✅ **React.StrictMode safe** - no duplicate requests
- ✅ **Type-safe** - full TypeScript coverage
- ✅ **Maintainable** - section-level separation of concerns

## What's Kept

All good improvements retained:
- ✅ PostgreSQL persistence
- ✅ Database models (User, Repository, Report, UserRepository)
- ✅ Repository pattern
- ✅ User repository tracking
- ✅ Auth improvements
- ✅ Frontend UI/UX fixes

## Cache Expiration Policy

From [CLAUDE.md](CLAUDE.md):

```
last_day: 1 hour
last_week: 6 hours
last_month: 24 hours
last_year: 7 days
```

TL;DR is NOT cached (always generated fresh).

## Rollback Plan

If needed, rollback database changes:

```sql
BEGIN;
ALTER TABLE reports DROP COLUMN IF EXISTS prs_generated_at;
ALTER TABLE reports DROP COLUMN IF EXISTS prs_expires_at;
ALTER TABLE reports DROP COLUMN IF EXISTS issues_generated_at;
ALTER TABLE reports DROP COLUMN IF EXISTS issues_expires_at;
ALTER TABLE reports DROP COLUMN IF EXISTS people_generated_at;
ALTER TABLE reports DROP COLUMN IF EXISTS people_expires_at;
ALTER TABLE reports DROP COLUMN IF EXISTS created_at;
ALTER TABLE reports DROP COLUMN IF EXISTS updated_at;
UPDATE reports SET version = 1 WHERE version = 2;
COMMIT;
```

Then restore previous code from git:
```bash
git checkout <previous-commit> backend/api/reports.py
git checkout <previous-commit> frontend/src/hooks/useTLDRData.ts
```

## Future Enhancements

Potential improvements (not included in this migration):

1. **Streaming sections** - Stream PRs/Issues as they're generated
2. **WebSocket updates** - Push cache updates to connected clients
3. **Background refresh** - Pre-warm cache before expiration
4. **Partial updates** - Re-fetch only expired sections
5. **Client-side caching** - IndexedDB for offline support

## Questions?

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation.
