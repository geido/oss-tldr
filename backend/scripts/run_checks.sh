#!/bin/bash
set -e

# Go into backend where pyproject.toml lives
cd backend

echo "🔎 Running Black..."
poetry run black .

echo "🔎 Running Ruff..."
poetry run ruff check .

echo "🔎 Running Mypy..."
poetry run mypy .