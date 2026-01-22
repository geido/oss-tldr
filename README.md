# 🧠 OSS TL;DR

**OSS TL;DR** is a multi-user FastAPI + React application that provides AI-powered summaries of GitHub repositories with secure OAuth authentication. Track multiple repositories, get intelligent summaries of issues, PRs, contributors, and code diffs using OpenAI.

## ✨ Features

- 🔒 **GitHub OAuth Authentication** - Secure login with your GitHub account
- 🏠 **Multi-Repository Dashboard** - Track and manage multiple repositories
- 🔍 **Smart Repository Discovery** - Autocomplete with your accessible repos and public search
- 📊 **AI-Powered Summaries** - TL;DRs of key pull requests, issues, and contributors
- 🔬 **Deep Dive Analysis** - Detailed PR diffs and discussion analysis
- 👥 **Contributor Insights** - Highlights of the most active contributors
- 📈 **Activity Filtering** - Real signal, not noise from bots and automated PRs
- 💾 **User-Specific Storage** - Your data stays private and persists across sessions
- 📱 **Mobile Responsive** - Works seamlessly on desktop and mobile devices

---

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/geido/oss-tldr.git
cd oss-tldr
```

### 2. Set up GitHub OAuth App

Create a new GitHub OAuth App at https://github.com/settings/applications/new:

- **Application name**: `OSS TL;DR`
- **Homepage URL**: `http://localhost:5173`
- **Authorization callback URL**: `http://localhost:5173/auth/callback`

Copy the `Client ID` and generate a `Client Secret`.

### 3. Configure environment variables

Copy the example and fill in your credentials:

```bash
cp backend/.env_example backend/.env
```

Edit `backend/.env` with your values:

```env
# GitHub OAuth (Required)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# OpenAI API (Required)
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini

# JWT Security (Change for production)
JWT_SECRET=your-secret-key-change-in-production

# Application Settings
MAX_ITEMS_PER_SECTION=10
FRONTEND_URL=http://localhost:5173
```

### 4. Run with Docker

```bash
docker compose build
docker compose up
```

Then open http://localhost:5173 in your browser and sign in with GitHub.

---

## 🏗️ Architecture

### Multi-User Authentication
- **GitHub OAuth 2.0** for secure authentication
- **JWT tokens** with automatic validation and refresh
- **User-specific data isolation** - each user sees only their repositories and reports
- **Automatic cleanup** when switching between GitHub accounts

### Smart Repository Management
- **Autocomplete discovery** showing your accessible repositories first
- **Public repository search** for exploring new projects
- **Access validation** with clear error messages for restricted repositories
- **Exclude filters** to avoid showing already-added repositories

### AI-Powered Analysis
- **Progressive loading** of PRs, issues, and contributors
- **Streaming TL;DR generation** with real-time updates
- **Bot filtering** to focus on human activity
- **Configurable timeframes** (last day, week, month, year)

---

## 🧪 Tech Stack

### Backend
- **Python 3.11** with FastAPI
- **PyGithub** for GitHub API integration
- **OpenAI API** for content generation
- **JWT** for secure authentication
- **Async/await** patterns for optimal performance

### Frontend
- **React 19** with TypeScript
- **Ant Design** for UI components
- **User authentication** with AuthContext
- **Progressive loading** with real-time updates
- **Mobile-responsive** design with styled-components

### Infrastructure
- **Docker & Docker Compose** for development
- **Pre-commit hooks** for code quality
- **CORS configuration** for secure cross-origin requests

---

## 🛠️ Development

### Backend Development

```bash
cd backend
poetry install
poetry run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Code Quality Tools:**
```bash
poetry run black .      # Code formatting
poetry run ruff check .  # Linting
poetry run mypy .        # Type checking
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev              # Development server
npm run build           # Production build
```

**Code Quality Tools:**
```bash
npm run lint            # ESLint
npm run type            # TypeScript check
```

### Pre-commit Setup

```bash
pre-commit install
pre-commit run --all-files
```

Configured to run: `black`, `mypy`, `ruff`, `eslint`, `tsc`

---

## 🔧 Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_CLIENT_ID` | OAuth App Client ID | `Iv1.a1b2c3d4e5f6g7h8` |
| `GITHUB_CLIENT_SECRET` | OAuth App Client Secret | `abc123def456...` |
| `OPENAI_API_KEY` | OpenAI API Key | `sk-proj-abc123...` |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model for generation |
| `JWT_SECRET` | `your-secret-key...` | JWT signing secret |
| `MAX_ITEMS_PER_SECTION` | `10` | Max items per section |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL for CORS |
| `JWT_EXPIRE_HOURS` | `24` | JWT token expiration |

---


## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Install pre-commit hooks (`pre-commit install`)
4. Make your changes with proper tests
5. Ensure all checks pass (`pre-commit run --all-files`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

---

## 📜 License

MIT © [Diego Pucci](https://github.com/geido)
