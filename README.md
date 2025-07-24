# 🧠 OSS TL;DR

**OSS TL;DR** is a FastAPI + React app that summarizes GitHub repositories — issues, PRs, contributors, and diffs — using OpenAI.

It helps you stay on top of what matters in an OSS repo by generating:

- ✨ TL;DRs of key pull requests and issues  
- 🔍 Deep dives on PR diffs and discussions  
- 👥 Highlights of the most active contributors  
- 📈 Activity filtered by real signal, not noise  

---

## 🚀 Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/geido/oss-tldr.git
cd oss-tldr
```

### 2. Set environment variables

Copy the example and fill in your API keys:

```bash
cp backend/.env_example backend/.env
```

Edit `backend/.env` with:

```env
GITHUB_TOKEN=your_github_token
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4.1-mini
MAX_ITEMS_PER_SECTION=10
```

### 3. Run with Docker

```bash
docker compose build
docker compose up
```

Then open http://localhost:5173 in your browser.

---

## 🧪 Tech Stack

- **Backend**: Python 3.11, FastAPI, PyGithub, OpenAI
- **Frontend**: React 19, Ant Design, Vite
- **Infra**: Docker, Docker Compose

---

## 🧼 Dev Experience

### Backend

- Type checking: `mypy`
- Formatting: `black`
- Linting: `ruff`
- Pre-commit hooks: configured for all tools
- Python version: 3.11

Run checks manually:

```bash
cd backend
poetry install
poetry run mypy .
poetry run black .
poetry run ruff .
```

### Frontend

- TypeScript with strict mode
- ESLint configured via `pre-commit`
- Code formatting via Prettier (optional)

Run lint and type checks:

```bash
cd frontend
npm install
npx eslint .
npx tsc --noEmit
```

---

## ✅ Pre-commit Setup

```bash
pre-commit install
pre-commit run --all-files
```

Configured to run:

- `black`
- `mypy`
- `ruff`
- `eslint`
- `tsc` (TypeScript check)

---

## 📜 License

MIT © [Diego Pucci](https://github.com/geido)
