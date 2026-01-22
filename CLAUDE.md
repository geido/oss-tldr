# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT: Documentation Maintenance

**ALL changes to this file (CLAUDE.md) MUST be mirrored into AGENTS.md**

When you update CLAUDE.md, you MUST also update AGENTS.md with the same information to ensure consistency across all AI assistants working on this codebase.

## Project Overview

OSS TL;DR is a multi-user FastAPI + React application that generates AI-powered summaries of GitHub repositories. The application features secure GitHub OAuth authentication, smart repository discovery, database-backed persistence, and user-specific data isolation. The backend uses OpenAI for content generation and PyGithub for GitHub API access.

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
  → GET /reports/{owner}/{repo}/tldr?timeframe=X     (checks cache or streams fresh)

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

All report sections (PRs, Issues, People, TL;DR) are cached in PostgreSQL:

- **Deterministic timeframes** - Date ranges based on day boundaries, not rolling windows:
  - `last_day`: Yesterday (00:00:00 to 23:59:59)
  - `last_week`: Last 7 complete days (not including today)
  - `last_month`: Last 30 complete days (not including today)
  - `last_year`: Last 365 complete days (not including today)
- **Permanent caching** - Once generated for a timeframe, data never changes (Oct 14-20 is always Oct 14-20)
- **Per-section caching** - PRs, Issues, People, and TL;DR cached independently
- **Shared across users** - Same repo+timeframe uses same cached data
- **Cache-first approach**: Always check cache before generating

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
poetry run black .       # Code formatting
poetry run ruff check .  # Linting
poetry run mypy .        # Type checking
poetry run pytest tests/unit/ -v  # Unit tests
./scripts/run_checks.sh  # Run all checks
```

#### Frontend
```bash
cd frontend
npm run lint            # ESLint
npm run type           # TypeScript check
npm run format         # Prettier formatting
npm test               # Run tests
```

#### Pre-commit
```bash
pre-commit install
pre-commit run --all-files
```

## Architecture

### Database & Persistence
- **PostgreSQL** database for persistent storage
- **SQLAlchemy ORM** with async support (asyncpg driver)
- **Database models** in `backend/database/models/` (separate files per model):
  - `user.py` - GitHub user information
  - `repository.py` - Cached repository metadata
  - `report.py` - Generated TL;DR reports with section-level caching
  - `user_repository.py` - User-repository tracking (many-to-many)
  - `user_report_access.py` - Report access tracking
  - `group.py` - Repository groups (system and user-created)
- **Repository pattern** in `backend/repositories/` for data access layer
- **Intelligent caching**: Reports shared across users, permanently cached per timeframe

### Groups Feature
- **System groups**: Predefined in `backend/groups/*.yaml`, seeded to database on startup
- **User groups**: Created via API, stored in database
- **Group reports**: Aggregated TL;DR across multiple repositories
- **CRUD endpoints**: Create, read, update, delete user groups

### Authentication & Security
- **GitHub OAuth 2.0** flow with JWT token management
- **AuthContext** (`frontend/src/contexts/AuthContext.tsx`) manages authentication state
- **AuthGuard** (`frontend/src/components/AuthGuard.tsx`) protects routes
- **Auth middleware** (`backend/middleware/auth.py`) validates requests
- **User upsert on login** to sync GitHub user data with database

### Backend Structure

```
backend/
├── api/                          # API layer (restructured)
│   ├── __init__.py               # Creates API router
│   ├── schemas/                  # Request/Response Pydantic models
│   │   ├── common.py             # Shared models (Timeframe, RepositorySummary)
│   │   ├── auth.py               # Auth schemas
│   │   ├── groups.py             # Group schemas
│   │   ├── reports.py            # Report section schemas
│   │   ├── repos.py              # Repository search schemas
│   │   └── users.py              # User tracking schemas
│   ├── routes/                   # FastAPI route handlers
│   │   ├── auth.py               # GitHub OAuth flow
│   │   ├── deepdive.py           # Deep dive analysis
│   │   ├── diff.py               # Diff explanation
│   │   ├── groups.py             # Group CRUD & reports
│   │   ├── reports.py            # Progressive report sections
│   │   ├── repos.py              # Repository discovery
│   │   └── users.py              # User repository tracking
│   └── helpers/                  # Utility functions for routes
│       └── groups.py             # Group helpers (slug generation, etc.)
├── database/
│   ├── connection.py             # Async database session
│   ├── schema.sql                # SQL schema definition
│   └── models/                   # SQLAlchemy ORM models
│       ├── user.py
│       ├── repository.py
│       ├── report.py
│       ├── user_repository.py
│       ├── user_report_access.py
│       └── group.py
├── repositories/                 # Data access layer
│   ├── users.py
│   ├── repositories.py
│   ├── reports.py
│   ├── user_repositories.py
│   └── groups.py
├── services/                     # Business logic
│   ├── github_client.py          # GitHub API operations
│   ├── tldr_generator.py         # AI summary generation
│   ├── group_report.py           # Group report generation
│   └── ...
├── middleware/
│   └── auth.py                   # JWT validation middleware
├── models/
│   └── github.py                 # GitHub entity data structures
├── utils/
│   ├── dates.py                  # Timeframe resolution
│   ├── group_config.py           # YAML config loading & seeding
│   └── ...
└── config.py                     # Environment configuration
```

### Frontend Structure
- **React 19** with TypeScript and strict mode
- **Ant Design** for UI components with custom styled-components
- **Main views**:
  - `DashboardView` - Repository and group management
  - `TLDRView` - Single repository report with progressive loading
  - `GroupTLDRView` - Multi-repository group report
- **Components**:
  - `RepoAutocomplete` - Smart repository discovery
  - `IssueListItem` - PR/issue display with diff and deep dive
  - `LoadableCollapse` - Progressive loading interface
- **Hooks**:
  - `useTLDRData` - Single repo report data loading
  - `useGroupTLDRData` - Group report data loading
- **Utils**:
  - `apiClient.ts` - Authenticated API client

### Key API Endpoints

**Reports (Progressive Loading)**:
- `GET /api/v1/reports/{owner}/{repo}/prs?timeframe=X` - Cached PR data
- `GET /api/v1/reports/{owner}/{repo}/issues?timeframe=X` - Cached issue data
- `GET /api/v1/reports/{owner}/{repo}/people?timeframe=X` - Cached contributor data
- `GET /api/v1/reports/{owner}/{repo}/tldr?timeframe=X` - Streaming TL;DR

**Groups**:
- `GET /api/v1/groups` - List system and user groups
- `POST /api/v1/groups` - Create user group
- `GET /api/v1/groups/{id}` - Get group details
- `PUT /api/v1/groups/{id}` - Update user group
- `DELETE /api/v1/groups/{id}` - Delete user group
- `POST /api/v1/groups/report` - Generate group report

**User Repository Tracking**:
- `GET /api/v1/users/me/repositories` - List tracked repos
- `POST /api/v1/users/me/repositories` - Track a repo
- `DELETE /api/v1/users/me/repositories` - Untrack a repo

**Repository Discovery**:
- `GET /api/v1/repos/user` - User's accessible repos
- `GET /api/v1/repos/search?q=...` - Search public repos

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
5. **User Upsert**: User record created/updated in database
6. **Client Storage**: Frontend stores JWT in localStorage
7. **API Requests**: All API requests include JWT in Authorization header

## Development Notes

### Backend Patterns
- Async/await patterns extensively used for GitHub API calls
- Rate limiting protection built into GitHub client with configurable thresholds
- Bot filtering configured in `config.py` to exclude common GitHub bots from analysis
- Authentication middleware automatically validates JWT and provides GitHub client
- TYPE_CHECKING imports for forward references in SQLAlchemy models

### Frontend Patterns
- Progressive loading to show results as they become available
- TypeScript strict mode enabled with comprehensive type definitions
- Mobile-first responsive design using styled-components
- User context management with AuthContext for authentication state
- Automatic token validation and refresh handling

### Security Considerations
- GitHub OAuth scope is "repo" (read-only access) with transparent user messaging
- JWT tokens automatically validated on each API request
- User data completely isolated - no cross-user data leakage
- CORS properly configured for cross-origin requests

### Storage Strategy
- **Database-backed**: All user data (repos, groups, reports) stored in PostgreSQL
- **localStorage**: Only used for JWT auth token and user info
- **No client-side caching**: Reports fetched from database on each view

## Mobile Responsiveness

The application is fully mobile-responsive with:
- Adaptive layouts using CSS media queries
- Responsive typography and spacing
- Mobile-optimized repository autocomplete
- Touch-friendly interface elements
- Optimized collapse headers for narrow screens
