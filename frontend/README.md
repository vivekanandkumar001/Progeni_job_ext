# Progeni AutoApply Frontend

This repository contains the frontend projects under `frontend/`:

- `web-dashboard/` — Next.js candidate dashboard.
- `chrome-extension/` — Chrome Manifest V3 extension.
- `admin-panel/` — admin interface prototype.

## Deploy the dashboard to Vercel

Import the repository root as a Vercel project and set **Root Directory** to `frontend/web-dashboard`. Use the detected Next.js framework and assign `job.progeni.live` to the dashboard project. The root `vercel.json` also routes `/api/v1/*` and `/health` to the backend service; preserve that routing when changing project configuration.

Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`, and `NEXT_PUBLIC_SITE_URL` for the dashboard. The API base should be same-origin (`https://job.progeni.live/api/v1/workspace`) when using the root Vercel routing. Configure the backend's Supabase and MongoDB variables and its exact allowed origins separately; see the root deployment runbook. Do not use a localhost API URL in production.

## Build the Chrome extension

```powershell
cd .\frontend\chrome-extension
npm ci
npm run typecheck
npm run build
```

In Chrome, enable Developer mode at `chrome://extensions` and choose **Load unpacked**, selecting `frontend\chrome-extension\dist`. The extension is not a website to host on Vercel.
