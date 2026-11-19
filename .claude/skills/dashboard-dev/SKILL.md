---
name: dashboard-dev
description: Develop the admin dashboard — the React/Vite/Tailwind/shadcn frontend (dashboard/frontend) and the FastAPI backend (dashboard/app/main.py). Use when adding UI features (charts, log detail drawer, filters, sort, pagination, CSV export, auto-refresh), components, pages, or backend endpoints/data shapes.
---

# Develop the dashboard

Two halves, one image:
- **Frontend** `dashboard/frontend/` — Vite + React 18 (JS/JSX), Tailwind v3.4,
  shadcn-style `src/components/ui/*`, Radix primitives, Recharts, lucide-react.
- **Backend** `dashboard/app/main.py` — FastAPI read-only proxy over the LiteLLM mgmt
  API, HTTP Basic auth, serves the built SPA from `app/webdist`.

## Local-workspace rules (do not violate)
- **No spend / cost / budget** anywhere. "Usage" means requests, tokens, latency.
- **No API-key create/revoke** UI or endpoints.
- Backend endpoints: `/api/health`, `/api/teams`, `/api/logs?days&limit`,
  `/api/models`, `/api/model-health` (slow — on-demand), and `POST /api/test`
  (playground — the only write, a real gateway call via the server-side master key).
  The SPA computes all analytics client-side from the logs array (for the selected
  range) + `/api/teams`.
- Pages: Overview, Request logs, Infrastructure, Playground, Teams.

## Frontend loop
```bash
cd dashboard/frontend
npm install
npm run dev     # fast iteration (point /api at the running backend on :8080)
npm run build   # MUST pass; produces dist/ (index.html + assets/) that the backend serves
```
- Keep asset URLs under `/assets/` (Vite default; backend serves that path).
- Design both light & dark themes; azure accent, reserved status colors; Inter +
  JetBrains Mono; tabular-nums; accessible focus + reduced-motion.

## Backend loop
- Guard every new route with `require_admin`. Never leak the master key.
- Normalize LiteLLM responses; tolerate missing fields; use `litellm_safe()` for
  optional calls.

## See it for real
The SPA is baked into the Docker image (not volume-mounted). To verify end-to-end:
```bash
docker compose up -d --build dashboard
```
then load http://localhost:8080 with the Basic-auth creds from `.env`. Reviewing the
diff is not enough — rebuild and look.

Prefer the `dashboard-frontend` / `gateway-backend` agents for focused work.
