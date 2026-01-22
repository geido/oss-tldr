# Progressive Loading Architecture

## Overview

OSS TL;DR uses progressive loading to provide optimal user experience. Users see results as they become available instead of waiting for a monolithic response.

## Architecture

### Progressive Loading Flow

```
Frontend fires parallel requests:
  → GET /reports/{owner}/{repo}/prs?timeframe=X
  → GET /reports/{owner}/{repo}/issues?timeframe=X
  → GET /reports/{owner}/{repo}/people?timeframe=X
  → GET /reports/{owner}/{repo}/tldr?timeframe=X

Each section:
  1. Checks database cache
  2. Returns immediately if cached (instant!)
  3. Generates fresh data if needed
  4. Stores in database for next request
```

### API Structure

The API is organized into:
- `api/routes/reports.py` - Progressive report section endpoints
- `api/schemas/reports.py` - Response models for each section

### Frontend Hooks

- `useTLDRData.ts` - Single repository reports with parallel section loading
- `useGroupTLDRData.ts` - Group reports across multiple repositories

**React.StrictMode Protection:**
- `requestInFlightRef` prevents duplicate requests
- `AbortController` for proper cleanup
- Request deduplication by `${repo}-${timeframe}` key

## Database Caching

### Permanent Caching Strategy

Reports are cached **permanently** because timeframes are deterministic:
- `last_day` = Yesterday (00:00:00 to 23:59:59)
- `last_week` = Last 7 complete days
- `last_month` = Last 30 complete days
- `last_year` = Last 365 complete days

Once data for Oct 14-20 is generated, it never changes - no expiration needed.

### Force Refresh

Users can bypass cache via `?force=true`:
```
GET /reports/{owner}/{repo}/prs?timeframe=last_week&force=true
```

## Benefits

### User Experience
- ✅ **Instant feedback** - sections load as ready
- ✅ **No blocking** - UI updates progressively
- ✅ **Cache benefits** - instant on cache hit
- ✅ **Parallel requests** - faster overall load

### Performance
- ✅ **Database caching** - shared across users
- ✅ **Permanent caching** - no expiration overhead
- ✅ **Reduced API calls** - cache hits save GitHub/OpenAI quota

### Developer Experience
- ✅ **Clear architecture** - documented in CLAUDE.md
- ✅ **React.StrictMode safe** - no duplicate requests
- ✅ **Type-safe** - full TypeScript coverage

## Testing Progressive Loading

1. Start the app: `docker compose up`
2. Open browser, generate a report
3. Watch console logs:
   - **First request:** `✗ Cache MISS for org/repo PRs (last_week) - generating`
   - **Second request:** `✓ Cache HIT for org/repo PRs (last_week)`
4. Observe progressive loading:
   - PRs appear first
   - Issues appear second
   - People appear third
   - TL;DR streams last

## See Also

- [CLAUDE.md](CLAUDE.md) - Detailed architecture documentation
- [PROJECT.md](PROJECT.md) - Database schema and design decisions
