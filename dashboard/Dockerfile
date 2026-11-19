# ---------------------------------------------------------------------------
# Stage 1 — build the React (Vite) frontend into static assets
# ---------------------------------------------------------------------------
FROM node:20-alpine AS frontend
WORKDIR /fe

# Install deps first for layer caching
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# Build the app -> /fe/dist
COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 — Python API server that also serves the built frontend
# ---------------------------------------------------------------------------
FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
# Drop the compiled SPA where FastAPI expects it (app/webdist)
COPY --from=frontend /fe/dist ./app/webdist

EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
