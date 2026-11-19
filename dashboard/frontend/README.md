# Gateway · litellm local — Admin Console (frontend)

A single-page React dashboard for a self-hosted LiteLLM gateway. It is a local
workspace admin console: traffic analytics, request logs, and team limits. There
is **no** spend/cost/budget view and **no** API-key management — keys are created
out-of-band via the provisioning script.

## Stack

- Vite 5 + React 18 (JavaScript + JSX)
- Tailwind CSS v3.4 + PostCSS + Autoprefixer
- shadcn/ui-style components (hand-authored, "new-york" aesthetic) in `src/components/ui/`
- Radix primitives (dialog/sheet, select, dropdown-menu, tabs, tooltip, slot)
- Recharts for all charts
- lucide-react icons

## Scripts

```bash
npm install     # install dependencies
npm run dev     # start the Vite dev server (proxies /api -> http://localhost:4000)
npm run build   # production build -> dist/
npm run preview # preview the production build locally
```

## Backend integration

The FastAPI backend serves the built output: `dist/index.html` at `/` and the
hashed assets under `dist/assets/*` at `/assets/*`. The app talks to the backend
over same-origin `/api/*`:

- `GET /api/health`
- `GET /api/teams`
- `GET /api/logs?days=<1|7|30>&limit=1000`

All analytics (tiles and charts on the Overview page) are computed client-side
from the logs array for the selected range plus the teams list. The page is
expected to sit behind HTTP Basic auth; the browser attaches credentials
automatically, so requests are made normally and errors are surfaced inline.

During local development, `vite.config.js` proxies `/api` to
`http://localhost:4000` so you can run the gateway and the dev server side by
side.

## Theme

Dark is the primary look; light is fully supported. The theme is toggled via a
`.dark` class on `<html>`, defaults to the OS preference, and is persisted to
`localStorage` under the key `gw-theme`.

## Build output

`npm run build` emits `dist/index.html` plus `dist/assets/*` (JS, CSS, and any
fonts/images). No root-level asset files other than `index.html` are produced.
The build is self-contained (no external CDN scripts); the Inter and JetBrains
Mono fonts are `@import`ed from Google Fonts at runtime by the browser.
