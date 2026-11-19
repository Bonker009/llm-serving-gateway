"""
LiteLLM Gateway Dashboard — a thin admin UI over the LiteLLM management API.

Mostly read-only observability (health, teams, logs, model inventory). The one
exception is the playground endpoint (``POST /api/test``), which sends a real
request through the gateway on the operator's behalf — an internal-dev convenience.

The master key lives ONLY here (server-side, from env); the browser never sees it.
The dashboard itself is protected with HTTP Basic auth. All calls to LiteLLM are
proxied through this process. A React (Vite) single-page app is served from
``app/webdist`` (produced by the frontend build stage of the Dockerfile).
"""
from __future__ import annotations

import mimetypes
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import time
from urllib.parse import urlsplit

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Config (from environment)
# ---------------------------------------------------------------------------
LITELLM_BASE_URL = os.environ.get("LITELLM_BASE_URL", "http://litellm:4000").rstrip("/")
LITELLM_MASTER_KEY = os.environ.get("LITELLM_MASTER_KEY", "")
DASHBOARD_USERNAME = os.environ.get("DASHBOARD_USERNAME", "admin")
DASHBOARD_PASSWORD = os.environ.get("DASHBOARD_PASSWORD", "")

# Built React app (Vite `dist`). Copied here by the Docker frontend stage.
WEB_DIR = Path(__file__).parent / "webdist"

app = FastAPI(title="LiteLLM Gateway Dashboard", docs_url=None, redoc_url=None)
security = HTTPBasic()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
def require_admin(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    """Guard every route with HTTP Basic auth (constant-time comparison)."""
    user_ok = secrets.compare_digest(credentials.username, DASHBOARD_USERNAME)
    pass_ok = bool(DASHBOARD_PASSWORD) and secrets.compare_digest(
        credentials.password, DASHBOARD_PASSWORD
    )
    if not (user_ok and pass_ok):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


# ---------------------------------------------------------------------------
# LiteLLM API helper
# ---------------------------------------------------------------------------
async def litellm(method: str, path: str, **kwargs) -> Any:
    """Call the LiteLLM management API with the master key. Raises on HTTP error."""
    headers = {"Authorization": f"Bearer {LITELLM_MASTER_KEY}"}
    url = f"{LITELLM_BASE_URL}{path}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.request(method, url, headers=headers, **kwargs)
    if resp.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"LiteLLM {method} {path} -> {resp.status_code}: {resp.text[:400]}",
        )
    if resp.headers.get("content-type", "").startswith("application/json"):
        return resp.json()
    return resp.text


async def litellm_safe(method: str, path: str, **kwargs) -> Any:
    """Like litellm() but returns None instead of raising (for optional endpoints)."""
    try:
        return await litellm(method, path, **kwargs)
    except Exception:
        return None


def _parse_dt(v: Any) -> datetime | None:
    if not v:
        return None
    try:
        s = str(v).replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except (TypeError, ValueError):
        return None


# Ports that are shared multi-tenant backends vs dedicated project backends.
_SHARED_PORTS = {"11434", "8001"}
_DEDICATED_PORTS = {"8002", "8003", "8004"}


def _host_port(api_base: Any) -> tuple[str | None, str | None]:
    """Split an api_base URL into (host, port). Tolerates missing/odd values."""
    if not api_base:
        return None, None
    try:
        parts = urlsplit(str(api_base))
        host = parts.hostname or (str(api_base).split("/")[0] or None)
        port = str(parts.port) if parts.port else None
        return host, port
    except ValueError:
        return None, None


def _tier_for_port(port: str | None) -> str:
    if port in _SHARED_PORTS:
        return "shared"
    if port in _DEDICATED_PORTS:
        return "dedicated"
    return "other"


# ---------------------------------------------------------------------------
# Data endpoints (normalized for the frontend)
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def api_health(_: str = Depends(require_admin)):
    live = await litellm_safe("GET", "/health/liveliness")
    return {"gateway": LITELLM_BASE_URL, "reachable": live is not None}


@app.get("/api/teams")
async def api_teams(_: str = Depends(require_admin)):
    raw = await litellm_safe("GET", "/team/list")
    teams = raw if isinstance(raw, list) else (raw or {}).get("teams", []) if raw else []
    out = []
    for t in teams or []:
        info = t.get("team_info", t) if isinstance(t, dict) else {}
        out.append(
            {
                "team_id": t.get("team_id"),
                "team_alias": t.get("team_alias") or info.get("team_alias"),
                "models": t.get("models") or info.get("models") or [],
                "rpm_limit": t.get("rpm_limit") or info.get("rpm_limit"),
                "tpm_limit": t.get("tpm_limit") or info.get("tpm_limit"),
            }
        )
    out.sort(key=lambda x: str(x["team_alias"] or ""))
    return out


@app.get("/api/logs")
async def api_logs(
    _: str = Depends(require_admin),
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(1000, ge=1, le=5000),
):
    """Per-request logs, enriched with latency and detail fields for the UI."""
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    params = {
        "start_date": start.strftime("%Y-%m-%d"),
        "end_date": end.strftime("%Y-%m-%d"),
    }
    raw = await litellm_safe("GET", "/spend/logs", params=params)
    rows = raw if isinstance(raw, list) else []
    out = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        meta = r.get("metadata") if isinstance(r.get("metadata"), dict) else {}
        t0 = _parse_dt(r.get("startTime") or r.get("starttime"))
        t1 = _parse_dt(r.get("endTime") or r.get("endtime"))
        latency_ms = None
        if r.get("response_time") is not None:
            try:
                latency_ms = round(float(r["response_time"]) * 1000)
            except (TypeError, ValueError):
                latency_ms = None
        elif t0 and t1:
            latency_ms = round((t1 - t0).total_seconds() * 1000)
        out.append(
            {
                "request_id": r.get("request_id"),
                "time": r.get("startTime") or r.get("starttime") or r.get("created_at"),
                "end_time": r.get("endTime") or r.get("endtime"),
                "latency_ms": latency_ms,
                "model": r.get("model"),
                "call_type": r.get("call_type"),
                "team_id": r.get("team_id"),
                "key_alias": meta.get("user_api_key_alias") or r.get("key_alias"),
                "user": r.get("user"),
                "end_user": r.get("end_user"),
                "cache_hit": r.get("cache_hit"),
                "api_base": r.get("api_base"),
                "status": r.get("status") or "success",
                "prompt_tokens": r.get("prompt_tokens"),
                "completion_tokens": r.get("completion_tokens"),
                "total_tokens": r.get("total_tokens"),
                "metadata": meta or None,
            }
        )
    out.sort(key=lambda x: str(x["time"] or ""), reverse=True)
    return out[:limit]


@app.get("/api/models")
async def api_models(_: str = Depends(require_admin)):
    """Backend model inventory from LiteLLM /model/info (merges yaml + DB models)."""
    raw = await litellm_safe("GET", "/model/info")
    items = []
    if isinstance(raw, dict):
        items = raw.get("data") or raw.get("models") or []
    elif isinstance(raw, list):
        items = raw
    out = []
    for m in items or []:
        if not isinstance(m, dict):
            continue
        params = m.get("litellm_params") or {}
        info = m.get("model_info") or {}
        raw_model = params.get("model") or ""
        provider = (
            info.get("litellm_provider")
            or (raw_model.split("/")[0] if "/" in raw_model else None)
        )
        api_base = params.get("api_base")
        host, port = _host_port(api_base)
        out.append(
            {
                "model_name": m.get("model_name"),
                "provider": provider,
                "model": raw_model,
                "api_base": api_base,
                "host": host,
                "port": port,
                "tier": _tier_for_port(port),
                "mode": info.get("mode"),
                "source": "db" if info.get("db_model") else "config",
            }
        )
    out.sort(key=lambda x: (x["tier"] != "shared", str(x["model_name"] or "")))
    return out


@app.get("/api/model-health")
async def api_model_health(_: str = Depends(require_admin)):
    """Live per-backend health. LiteLLM /health actively pings each endpoint (slow)."""
    raw = await litellm_safe("GET", "/health")
    raw = raw if isinstance(raw, dict) else {}

    def _norm(entries: Any) -> list[dict]:
        rows = []
        for e in entries or []:
            if not isinstance(e, dict):
                continue
            rows.append(
                {
                    "model": e.get("model") or e.get("model_name"),
                    "api_base": e.get("api_base"),
                    "latency_ms": (
                        round(float(e["response_time"]) * 1000)
                        if e.get("response_time") is not None
                        else None
                    ),
                    "error": e.get("error"),
                }
            )
        return rows

    return {
        "reachable": bool(raw),
        "healthy": _norm(raw.get("healthy_endpoints")),
        "unhealthy": _norm(raw.get("unhealthy_endpoints")),
    }


class TestRequest(BaseModel):
    model: str
    kind: str = "chat"  # "chat" | "embedding"
    prompt: str
    max_tokens: int = 256


@app.post("/api/test")
async def api_test(body: TestRequest, _: str = Depends(require_admin)):
    """Playground: send a real request through the gateway (server-side master key).

    Internal-use convenience — this performs an actual inference call. The master key
    never leaves the server. max_tokens is capped defensively.
    """
    max_tokens = max(1, min(int(body.max_tokens or 256), 2048))
    started = time.monotonic()
    try:
        if body.kind == "embedding":
            result = await litellm(
                "POST", "/embeddings", json={"model": body.model, "input": body.prompt}
            )
        else:
            result = await litellm(
                "POST",
                "/chat/completions",
                json={
                    "model": body.model,
                    "messages": [{"role": "user", "content": body.prompt}],
                    "max_tokens": max_tokens,
                },
            )
    except HTTPException as exc:
        return {
            "ok": False,
            "latency_ms": round((time.monotonic() - started) * 1000),
            "error": exc.detail,
        }

    latency_ms = round((time.monotonic() - started) * 1000)
    result = result if isinstance(result, dict) else {}
    text = None
    if body.kind == "embedding":
        data = result.get("data") or []
        vec = data[0].get("embedding") if data and isinstance(data[0], dict) else None
        text = f"embedding vector · {len(vec)} dimensions" if vec else None
    else:
        choices = result.get("choices") or []
        if choices and isinstance(choices[0], dict):
            text = (choices[0].get("message") or {}).get("content")
    return {
        "ok": True,
        "latency_ms": latency_ms,
        "text": text,
        "usage": result.get("usage"),
        "raw": result,
    }


# ---------------------------------------------------------------------------
# React SPA (single-page, auth-guarded)
# ---------------------------------------------------------------------------
@app.get("/", response_class=HTMLResponse)
async def index(_: str = Depends(require_admin)):
    index_html = WEB_DIR / "index.html"
    if not index_html.exists():
        return HTMLResponse(
            "<h1>Dashboard not built</h1><p>Run the Docker build so the Vite "
            "frontend is compiled into <code>app/webdist</code>.</p>",
            status_code=503,
        )
    return HTMLResponse(index_html.read_text(encoding="utf-8"))


@app.get("/assets/{path:path}")
async def web_assets(path: str, _: str = Depends(require_admin)):
    """Serve hashed Vite assets (JS/CSS/fonts), auth-guarded, no traversal."""
    target = (WEB_DIR / "assets" / path).resolve()
    assets_root = (WEB_DIR / "assets").resolve()
    if not str(target).startswith(str(assets_root)) or not target.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    media_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    return FileResponse(target, media_type=media_type)


@app.on_event("startup")
async def _warn_config():
    if not LITELLM_MASTER_KEY:
        print("WARNING: LITELLM_MASTER_KEY is not set — API calls will fail.")
    if not DASHBOARD_PASSWORD:
        print("WARNING: DASHBOARD_PASSWORD is not set — the dashboard will reject all logins.")
