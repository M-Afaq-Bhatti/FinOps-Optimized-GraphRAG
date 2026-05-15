# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python backend + bundled frontend ─────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install uv for fast dependency resolution
RUN pip install uv --no-cache-dir

# Copy Python project files
COPY pyproject.toml ./
COPY src/ ./src/
COPY data/ ./data/

# Install Python dependencies
RUN uv pip install --system -r pyproject.toml 2>/dev/null || \
    pip install lightrag-hku==1.4.15 google-genai python-dotenv fastapi "uvicorn[standard]" python-multipart openai --no-cache-dir

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create storage directories
RUN mkdir -p rag_storage data

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

# Run the FastAPI server
CMD ["python", "-m", "uvicorn", "src.server:app", "--host", "0.0.0.0", "--port", "8000"]
