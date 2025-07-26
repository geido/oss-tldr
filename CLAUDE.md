# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OSS TL;DR is a multi-user FastAPI + React application that generates AI-powered summaries of GitHub repositories. The application features secure GitHub OAuth authentication, smart repository discovery, and user-specific data isolation. The backend uses OpenAI for content generation and PyGithub for GitHub API access.

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

### Authentication & Security
- **GitHub OAuth 2.0** flow with JWT token management
- **AuthContext** (`frontend/src/contexts/AuthContext.tsx`) manages authentication state
- **AuthGuard** (`frontend/src/components/AuthGuard.tsx`) protects routes
- **Auth middleware** (`backend/middleware/auth.py`) validates requests
- **User-specific storage** with automatic cleanup when switching users

### Backend Structure
- **FastAPI routers** in `api/` handle different endpoints:
  - `auth.py` - GitHub OAuth flow and token validation
  - `repos.py` - User repository discovery and search
  - `tldr.py`, `issues.py`, `prs.py`, `people.py` - Core analysis endpoints
  - `diff.py`, `deepdive.py` - Advanced analysis features
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
  - `useTLDRData` - Manages TL;DR data loading with user-aware storage
- **Utils**:
  - `userStorage.ts` - User-specific localStorage with automatic cleanup
  - `tldrStorage.ts` - TL;DR report storage with user isolation
  - `apiClient.ts` - Authenticated API client with automatic token injection

### Key Integration Points
- Frontend makes parallel API calls to `/api/v1/prs`, `/api/v1/issues`, `/api/v1/people`
- Repository discovery via `/api/v1/repos/user` and `/api/v1/repos/search`
- TL;DR generation streams via `/api/v1/tldr` after PR/issue summaries are complete
- GitHub search API used for filtering and scoring items by engagement
- OpenAI integration for content generation with configurable models
- User-specific data storage that automatically clears when switching GitHub accounts

## Environment Setup

Required environment variables in `backend/.env`:

### OAuth & Security (Required)
- `GITHUB_CLIENT_ID`: GitHub OAuth App Client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth App Client Secret
- `OPENAI_API_KEY`: OpenAI API key

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