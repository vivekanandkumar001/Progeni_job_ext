# Progeni AutoApply Frontend

This branch contains the frontend projects at the repository root:

- `web-dashboard/` — Next.js candidate dashboard.
- `chrome-extension/` — Chrome Manifest V3 extension.
- `admin-panel/` — admin interface prototype.

## Deploy the dashboard to Vercel

Import this repository branch (`frontend`) as a Vercel project. Set **Root Directory** to `web-dashboard`, use the detected Next.js framework, and deploy. Assign `job.progeni.live` to this dashboard project in **Settings → Domains**, removing it from any previous Vercel project first if necessary.

The dashboard still calls the development backend at `http://127.0.0.1:5000`. Vercel deployment only hosts the website; candidate API features will not work for public visitors until a production API, durable storage, authentication, and matching API/CORS configuration are deployed.

## Build the Chrome extension

```powershell
cd .\chrome-extension
npm ci
npm run typecheck
npm run build
```

In Chrome, enable Developer mode at `chrome://extensions` and choose **Load unpacked**, selecting `chrome-extension\dist`. The extension is not a website to host on Vercel.
