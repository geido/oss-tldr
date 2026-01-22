#!/bin/bash
set -e

# Go into backend where pyproject.toml lives
cd backend

if ! poetry run black --version >/dev/null 2>&1; then
  echo "🔧 Installing backend dev dependencies (missing black)..."
  poetry install --with dev --no-root
fi

echo "🔎 Running Black..."
poetry run black .

echo "🔎 Running Ruff..."
poetry run ruff check . --fix

echo "🔎 Running Mypy..."
poetry run mypy .
