#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# start-dev.sh  — quick local development launcher
# Usage: bash start-dev.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Check .env exists
if [ ! -f .env ]; then
  echo "⚠️  .env not found. Copying from .env.example…"
  cp .env.example .env
  echo "✏️  Edit .env and add your GEMINI_API_KEY, then re-run this script."
  exit 1
fi

# Check GEMINI_API_KEY is set
source .env
if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "your_gemini_api_key_here" ]; then
  echo "❌  GEMINI_API_KEY is not set in .env"
  echo "   Get your free key at: https://aistudio.google.com"
  exit 1
fi

echo "✅  GEMINI_API_KEY found"

# Install Python deps if needed
if ! python -c "import lightrag" 2>/dev/null; then
  echo "📦  Installing Python dependencies…"
  pip install lightrag-hku==1.4.15 google-genai python-dotenv fastapi "uvicorn[standard]" python-multipart openai
fi

# Install and build frontend
if [ ! -d frontend/node_modules ]; then
  echo "📦  Installing frontend dependencies…"
  cd frontend && npm install && cd ..
fi

echo ""
echo "🚀  Starting LightRAG backend on http://localhost:8000"
echo "   (API docs: http://localhost:8000/docs)"
echo ""
echo "   For the dev frontend with hot reload, run in a second terminal:"
echo "   cd frontend && npm run dev"
echo ""

# Start backend
PYTHONPATH=. uvicorn src.server:app --reload --host 0.0.0.0 --port 8000
