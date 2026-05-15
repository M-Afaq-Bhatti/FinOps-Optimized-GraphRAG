#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# build-and-serve.sh — build React app then serve everything from FastAPI
# Usage: bash build-and-serve.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "🔨  Building React frontend…"
cd frontend
npm install
npm run build
cd ..

echo "✅  Frontend built to frontend/dist/"
echo ""
echo "🚀  Starting production server on http://0.0.0.0:8000"
echo "   (serves both API and React app)"
echo ""

PYTHONPATH=. uvicorn src.server:app --host 0.0.0.0 --port 8000
