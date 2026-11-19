---
name: run-stack
description: Build, start, stop, and check the LiteLLM gateway stack (litellm gateway :4000, Postgres, and the admin dashboard :8080) with docker compose. Use when asked to run/start/restart the stack or the dashboard, rebuild after changes, check status, or tail logs.
---

# Run the gateway stack

Services (`docker-compose.yml`): `litellm` (:4000), `litellm-db` (Postgres),
`dashboard` (:8080). The dashboard image **builds the React SPA** in a Node stage, so
any frontend/backend change needs a rebuild to go live.

## Commands
```bash
docker compose up -d --build            # build + start everything
docker compose up -d --build dashboard  # rebuild + restart just the dashboard
docker compose restart litellm          # reload after editing litellm_config.yaml
docker compose ps                        # status
docker compose logs -f dashboard         # tail dashboard logs
docker compose down                      # stop (keeps the pgdata volume)
```

## Access & verify
- Dashboard: http://localhost:8080 — HTTP Basic auth with `DASHBOARD_USERNAME` /
  `DASHBOARD_PASSWORD` from `.env`.
- Gateway: http://localhost:4000.
- Smoke test (reads creds from `.env`, prints status codes only — never echo the
  password):
```bash
set -a && . ./.env && set +a
curl -s -o /dev/null -w '%{http_code}\n' -u "$DASHBOARD_USERNAME:$DASHBOARD_PASSWORD" http://localhost:8080/
curl -s -u "$DASHBOARD_USERNAME:$DASHBOARD_PASSWORD" http://localhost:8080/api/health
```

## Gotchas
- `.env` must exist (copy from `.env.example`) with `DASHBOARD_PASSWORD`,
  `LITELLM_MASTER_KEY`, `POSTGRES_PASSWORD` set, or services reject logins / API calls.
- `POSTGRES_PASSWORD` must match the password embedded in `DATABASE_URL`.
- A UI edit that "doesn't show up" almost always means the dashboard image wasn't
  rebuilt — re-run `docker compose up -d --build dashboard`.
- **Gateway Prisma `Exec format error` on startup**: the `litellm` image is pinned to
  `ghcr.io/berriai/litellm:main-stable` with `platform: linux/amd64` in
  `docker-compose.yml`. `main-latest` shipped a Prisma query-engine binary that failed
  to exec on this host; the stable tag + explicit amd64 platform fixes it. After
  changing the image: `docker compose pull litellm && docker compose up -d litellm`,
  then confirm `curl http://localhost:4000/health/liveliness` returns 200.
