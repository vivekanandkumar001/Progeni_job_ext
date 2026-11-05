# Progeni AutoApply

Progeni AutoApply is a Chrome extension and candidate workspace. It helps candidates maintain a career profile, analyze resumes for reviewable details and skill evidence, detect or enter jobs, review explainable matches, prepare application answers, and track their job search. Production accounts use Supabase Auth and a MongoDB-backed API. It does not submit applications.

## Chrome extension and website are different builds

- **Chrome extension:** `frontend/chrome-extension` is a Manifest V3 browser extension. It is not a website, and deploying its Vite output to Vercel will not make the popup or side panel work at a normal URL. Build it and load the generated extension into Chrome.
- **Candidate dashboard:** `frontend/web-dashboard` is the Next.js website. Deploy this app to Vercel if `job.progeni.live` is meant to open the candidate workspace.

### Build and load the extension locally

From the repository root in PowerShell:

```powershell
cd .\frontend\chrome-extension
npm ci
npm run typecheck
npm run build:local
```

In Chrome, go to `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `frontend\chrome-extension\dist`. Keep this generated `dist` folder intact: it contains the extension manifest, popup, side panel, service worker, and content scripts. For Chrome Web Store submission, ZIP the **contents** of `dist` (including `manifest.json` at the ZIP root), not the repository or a Vercel deployment.

### Deploy the connected web services to Vercel

The root `vercel.json` defines Vercel Services (currently Beta). Import the repository as **one Vercel project** and set its **Root Directory** to the repository root, not `backend` or a frontend folder. Requests to `api.job.progeni.live` and the `/api/v1/*` and `/health` paths on the main domain go to the Express backend; other main-domain paths go to the candidate dashboard. The admin panel and extension build services have no public routes.

Configure these production variables in the Vercel project without committing secrets:

- Backend: `MONGODB_URI`, `MONGODB_DB`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NODE_PATH=backend/node_modules`, and `CORS_ALLOWED_ORIGINS` (exact origins, for example `https://job.progeni.live,chrome-extension://<published-extension-id>` after the Chrome Web Store assigns the extension ID; do not use a wildcard).
- Dashboard: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- The extension Vite build reads those public Supabase values from the Vercel build environment. The extension API uses `https://job.progeni.live/api/v1/workspace`.

Attach `job.progeni.live` and `api.job.progeni.live` to this Vercel project and apply the DNS records Vercel requests. Verify `/health` before sharing the dashboard URL. The public API requires a Supabase bearer token; health checks do not expose candidate data.

**Vercel does not install a Chrome extension.** Build a production package with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` available to Vite, then submit a ZIP of the `dist` folder contents to the Chrome Web Store. The ZIP must have `manifest.json` at its root. `npm run build:local` is only for local testing and targets the local backend. The Web Store listing needs a published privacy-policy URL and support contact. Its stable ID is also required to add the extension's exact origin to the backend CORS allowlist, without which extension API calls will be blocked.

### How the local pieces connect

```text
Local development:
Dashboard + Chrome extension ──> http://127.0.0.1:5000/api/v1/local
                                  local JSON data

Production:
Dashboard + Chrome extension ──> https://job.progeni.live/api/v1/workspace
                                  Supabase Auth → Express → MongoDB Atlas
```

In local development, the API binds to loopback and uses a JSON file under `%LOCALAPPDATA%\ProgeniAutoApply`. Production clients sign in with Supabase; the API verifies each bearer token and stores the candidate's workspace under that Supabase user ID in MongoDB. Do not expose `/api/v1/local` or the local JSON file to the internet. See [`backend/README.md`](./backend/README.md) for backend environment variables and deployment details.

## Run locally

Clone the repository, then use three PowerShell terminals from the repository directory. Node.js 20.16+ or 22.3+ is recommended.

### 1. Start the backend

```powershell
cd .\backend
npm install
npm run dev
```

In local development, the API binds to `127.0.0.1:5000` and uses a local JSON data file under `%LOCALAPPDATA%\ProgeniAutoApply`. No Supabase account or AI-provider key is required for this MVP.

### 2. Start the candidate dashboard

```powershell
cd .\frontend\web-dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The home page redirects to `/dashboard`. Accept the data notice before entering profile or job information.

### 3. Build and load the Chrome extension

```powershell
cd .\frontend\chrome-extension
npm install
npm run build:local
```

In Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select:

```text
.\frontend\chrome-extension\dist
```

Open a supported Naukri, LinkedIn, or Indeed job page and use the extension. Refresh a job page if it was already open when the extension was loaded. The content script reads job details only when you choose **Detect this job**. In local development, the local backend stores workspace data. In production, the extension uses the signed-in account workspace.

## What this MVP does and does not do

- Matching is deterministic and explainable. It compares user-entered profile skills and experience with details provided for a job; it is not an AI assessment or hiring probability.
- Skills mentioned in a job description are not assumed to be mandatory qualifications. Missing profile or job information is reported as unknown.
- Profile-based application details are suggestions for the candidate to review and copy manually. Subjective and sensitive screening questions are left to the candidate.
- Resume intelligence parses PDF, DOCX, and UTF-8 text files (maximum 5 MB). In production, the selected file is sent to the Progeni API for parsing. It suggests contact details, explicit experience statements, and skills from a fixed catalog with short matching text snippets. Candidates review and confirm all details. Scanned PDFs require OCR, which is not included.
- The original resume and full extracted text are not retained. Confirmed profile fields and short skill-evidence snippets are stored in the workspace. Remove a resume record to remove its evidence snippets; confirmed profile fields remain until edited or the workspace is cleared.
- Tracker statuses are self-reported. A “submitted” status does not verify that a job site received an application.
- Application submission, CAPTCHA/OTP handling, and bypassing website controls are not implemented.
- AI-provider integration, job recommendations, interview coaching, analytics, and the admin interface are not part of this candidate MVP.

## Privacy and release readiness

The dashboard and extension require explicit consent before using candidate data. Use **Privacy & data** in the dashboard to clear workspace records and withdraw consent. The local JSON file is intended only for local development and is not encrypted at the application layer. The production dashboard and extension require configured Supabase, MongoDB Atlas, Vercel routing, and a published Chrome Web Store listing before public use.

Chrome’s extension documentation describes content-script access and message-based communication with the extension. The Chrome Web Store policy also requires prominent disclosure and consent for user-data handling, including local processing, and secure handling/storage. Review these requirements before any public release:

- [Manifest V3 overview](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome Web Store user data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Chrome Web Store program policies](https://developer.chrome.com/docs/webstore/program-policies/policies)

## Project layout

- `backend/` — local development API and candidate data services.
- `frontend/chrome-extension/` — Manifest V3 extension.
- `frontend/web-dashboard/` — candidate workspace.
- `frontend/admin-panel/` — admin interface prototype.

The extension can be built independently. Resume analysis and the shared candidate workspace require the local backend; the dashboard is an optional companion. See [Deploy the candidate dashboard to Vercel](#deploy-the-candidate-dashboard-to-vercel) for its project root and domain setup.

The GitHub repository also has separate `frontend` and `backend` branches. The `frontend` branch contains the frontend projects at its root, so its Vercel dashboard Root Directory is `web-dashboard`. The `backend` branch contains the backend project at its root. The `main` branch remains the complete monorepo.
