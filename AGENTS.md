# AGENTS.md

This file provides guidance to AI assistants working on this codebase.

## IMPORTANT: Documentation Maintenance

**ALL changes to CLAUDE.md MUST be mirrored into this file (AGENTS.md)**

This file should remain in sync with CLAUDE.md to ensure consistency across all AI assistants working on this codebase.

## Project Overview

OSS TL;DR is a multi-user FastAPI + React application that generates AI-powered summaries of GitHub repositories. The application features secure GitHub OAuth authentication, smart repository discovery, and user-specific data isolation. The backend uses OpenAI for content generation and PyGithub for GitHub API access.

## 🚨 CRITICAL UX PRINCIPLES 🚨

### Progressive Loading is MANDATORY

**NEVER create or modify endpoints that return monolithic reports in a single request.**

The application MUST maintain progressive loading for optimal user experience:

1. **Frontend orchestrates multiple parallel API calls** - not a single blocking request
2. **Each section loads independently**: PRs, Issues, People, TL;DR
3. **UI updates progressively** as each section completes
4. **Database caching happens per-section** - not for entire reports
5. **Users see results immediately** instead of waiting for everything

**Correct Architecture:**
```
Frontend fires parallel requests:
  → GET /reports/{owner}/{repo}/prs?timeframe=X      (checks cache, returns/generates PRs)
  → GET /reports/{owner}/{repo}/issues?timeframe=X   (checks cache, returns/generates Issues)
  → GET /reports/{owner}/{repo}/people?timeframe=X   (checks cache, returns/generates People)
  → POST /tldr (after prs+issues complete)           (streams AI-generated summary)

Each endpoint:
  1. Checks database cache for that section
  2. Returns cached data if valid (instant response)
  3. Generates fresh data if expired or missing
  4. Stores generated data in database for next request
  5. Returns data to frontend
```

**WRONG Architecture (DO NOT USE):**
```
❌ POST /reports/generate → waits for all sections → returns monolithic report
❌ Any endpoint that blocks until PRs + Issues + People + TL;DR are all ready
```

### React.StrictMode Double-Request Prevention

The frontend uses React.StrictMode which causes double-mounting in development. **ALL API-calling hooks and components MUST implement safeguards**:

**Required patterns:**
```typescript
// 1. Use refs to track in-flight requests
const requestInFlightRef = useRef(false);
const lastRequestRef = useRef<string>("");

// 2. Prevent duplicate requests
const requestKey = `${repo}-${timeframe}`;
if (requestInFlightRef.current && lastRequestRef.current === requestKey) {
  return; // Skip duplicate
}

// 3. Set flags before request
requestInFlightRef.current = true;
lastRequestRef.current = requestKey;

// 4. Clear flags in finally block
try {
  // ... API call
} finally {
  requestInFlightRef.current = false;
}

// 5. Use AbortController for cancellation
const abortController = new AbortController();
// Store in ref for cleanup
// Cancel on unmount or new request
```

**Why this matters:**
- Without these safeguards, StrictMode fires duplicate requests
- Wastes API quota (OpenAI, GitHub)
- Creates race conditions
- Poor user experience

### Database-Backed Caching Strategy

All report sections (PRs, Issues, People) MUST be cached in PostgreSQL:

- **Deterministic timeframes** - Date ranges based on day boundaries, not rolling windows:
  - `last_day`: Yesterday (00:00:00 to 23:59:59)
  - `last_week`: Last 7 complete days (not including today)
  - `last_month`: Last 30 complete days (not including today)
  - `last_year`: Last 365 complete days (not including today)
- **No expiration** - Once generated for a timeframe, data never changes (Oct 14-20 is always Oct 14-20)
- **Per-section caching** - PRs, Issues, and People load independently
- **Shared across users** - Same repo+timeframe uses same cached data
- **Cache-first approach**: Always check cache before generating
- **TL;DR is NOT cached** - Always streamed fresh (user-specific summaries)

## Development Commands

### Backend (Python FastAPI)
```bash
cd backend
poetry install
poetry run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev              # Development server
npm run build           # Production build
npm run preview         # Preview production build
```

### Docker Development
```bash
docker compose build
docker compose up
```

### Code Quality & Testing

#### Backend
```bash
cd backend
poetry run black .      # Code formatting
poetry run ruff check .  # Linting
poetry run mypy .        # Type checking
./scripts/run_checks.sh  # Run all checks
```

#### Frontend
```bash
cd frontend
npm run lint            # ESLint
npm run type           # TypeScript check
npm run format         # Prettier formatting
```

#### Pre-commit
```bash
pre-commit install
pre-commit run --all-files
```

## Architecture

### Database & Persistence
- **PostgreSQL** database for persistent storage of users, repositories, and reports
- **SQLAlchemy ORM** with async support (asyncpg driver)
- **Database models** in `backend/database/models.py`:
  - `User` - GitHub user information
  - `Repository` - Cached repository metadata
  - `Report` - Generated TL;DR reports with expiration
  - `UserRepository` - User-repository tracking (many-to-many)
  - `UserReportAccess` - Report access tracking
- **Repository pattern** in `backend/repositories/` for data access layer
- **Intelligent caching**: Reports shared across users with configurable expiration
- **Cache expiration policy**:
  - `last_day`: 1 hour
  - `last_week`: 6 hours
  - `last_month`: 24 hours
  - `last_year`: 7 days

### Authentication & Security
- **GitHub OAuth 2.0** flow with JWT token management
- **AuthContext** (`frontend/src/contexts/AuthContext.tsx`) manages authentication state
- **AuthGuard** (`frontend/src/components/AuthGuard.tsx`) protects routes
- **Auth middleware** (`backend/middleware/auth.py`) validates requests
- **User upsert on login** to sync GitHub user data with database

### Backend Structure
- **FastAPI routers** in `api/` handle different endpoints:
  - `auth.py` - GitHub OAuth flow and token validation
  - `repos.py` - User repository discovery and search
  - `reports.py` - Progressive report endpoints with database caching (prs, issues, people)
  - `user_repos.py` - User repository tracking (DB-backed)
  - `tldr.py` - Streaming TL;DR generation
  - `diff.py`, `deepdive.py` - Advanced analysis features
- **Database layer**:
  - `database/connection.py` - Async database session management
  - `database/models.py` - SQLAlchemy ORM models
  - `repositories/*.py` - Repository pattern for data access
- **Services** in `services/` contain business logic for GitHub API integration and AI generation
- **GitHub client** (`services/github_client.py`) provides async GitHub API operations with rate limiting
- **Models** in `models/` define data structures for GitHub entities
- **Config** (`config.py`) manages environment variables and GitHub OAuth settings

### Frontend Structure
- **React 19** with TypeScript and strict mode
- **Ant Design** for UI components with custom styled-components for mobile responsiveness
- **Main views**:
  - `DashboardView` - Multi-repository management with autocomplete search
  - `TLDRView` - Results display with progressive loading and mobile optimization
- **Components**:
  - `RepoAutocomplete` - Smart repository discovery with user repos and public search
  - `IssueListItem` - Individual PR/issue display with diff and deep dive features
  - `LoadableCollapse` - Progressive loading interface for large data sets
- **Hooks**:
  - `useTLDRData` - Manages TL;DR data loading (database-backed)
- **Utils**:
  - `apiClient.ts` - Authenticated API client with database-backed methods

### Key Integration Points
- **Progressive report loading with database caching**:
  - `GET /api/v1/reports/{owner}/{repo}/prs?timeframe=X` - Cached PR data
  - `GET /api/v1/reports/{owner}/{repo}/issues?timeframe=X` - Cached issue data
  - `GET /api/v1/reports/{owner}/{repo}/people?timeframe=X` - Cached contributor data
  - `POST /api/v1/tldr` - Streaming TL;DR generation (not cached)
- **User repository tracking**: `/api/v1/users/me/repositories` (GET/POST/DELETE)
- **Repository discovery**: `/api/v1/repos/user` and `/api/v1/repos/search`
- **GitHub search API** for filtering and scoring items by engagement
- **OpenAI integration** for content generation with configurable models

## Environment Setup

Required environment variables in `backend/.env`:

### OAuth & Security (Required)
- `GITHUB_CLIENT_ID`: GitHub OAuth App Client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth App Client Secret
- `OPENAI_API_KEY`: OpenAI API key

### Database (Required)
- `DATABASE_URL`: PostgreSQL connection string (default: postgresql+asyncpg://oss_tldr:dev_password@postgres:5432/oss_tldr)
- `DB_POOL_SIZE`: Connection pool size (default: 20)
- `DB_MAX_OVERFLOW`: Max overflow connections (default: 10)
- `DB_POOL_TIMEOUT`: Pool timeout in seconds (default: 30)

### Optional Configuration
- `JWT_SECRET`: JWT signing secret (change for production)
- `OPENAI_MODEL`: Model to use (default: gpt-4o-mini)
- `MAX_ITEMS_PER_SECTION`: Limit for items per section (default: 10)
- `FRONTEND_URL`: Frontend URL for CORS (default: http://localhost:5173)
- `JWT_EXPIRE_HOURS`: JWT token expiration (default: 24)

## Authentication Flow

1. **Login**: User clicks login → redirected to GitHub OAuth
2. **Callback**: GitHub redirects to `/auth/callback` with code
3. **Token Exchange**: Backend exchanges code for GitHub token and user info
4. **JWT Creation**: Backend creates JWT with user data and GitHub token
5. **Client Storage**: Frontend stores JWT and user data in localStorage
6. **API Requests**: All API requests include JWT in Authorization header
7. **User Switching**: Automatic detection and cleanup when user changes

## Development Notes

### Backend Patterns
- Async/await patterns extensively used for GitHub API calls
- Rate limiting protection built into GitHub client with configurable thresholds
- Bot filtering configured in `config.py` to exclude common GitHub bots from analysis
- Authentication middleware automatically validates JWT and provides GitHub client
- User-aware storage ensures data isolation between different GitHub users

### Frontend Patterns
- Progressive loading to show results as they become available
- TypeScript strict mode enabled with comprehensive type definitions
- Mobile-first responsive design using styled-components
- User context management with AuthContext for authentication state
- Automatic token validation and refresh handling
- Repository autocomplete with smart filtering and caching

### Security Considerations
- GitHub OAuth scope is "repo" (read-only access) with transparent user messaging
- JWT tokens automatically validated on each API request
- User data completely isolated - no cross-user data leakage
- Automatic cleanup when switching between GitHub accounts
- CORS properly configured for cross-origin requests

### Storage Strategy
- **User-specific keys**: All localStorage uses format `${key}:${userId}`
- **Automatic cleanup**: Previous user data cleared when switching accounts
- **Persistence**: Data preserved for same user across sessions
- **Repository storage**: `oss-tldr-repos:${userId}`
- **TL;DR storage**: `oss-tldr-reports:${userId}`

## Mobile Responsiveness

The application is fully mobile-responsive with:
- Adaptive layouts using CSS media queries
- Responsive typography and spacing
- Mobile-optimized repository autocomplete
- Touch-friendly interface elements
- Optimized collapse headers for narrow screens
