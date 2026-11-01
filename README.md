# Progeni AutoApply

Progeni AutoApply is a Chrome extension with a local candidate dashboard and backend. It helps candidates maintain a career profile, analyze resumes for reviewable details and skill evidence, detect or enter jobs, review explainable matches, prepare application answers, and track their job search. It does not submit applications.

## Chrome extension and website are different builds

- **Chrome extension:** `frontend/chrome-extension` is a Manifest V3 browser extension. It is not a website, and deploying its Vite output to Vercel will not make the popup or side panel work at a normal URL. Build it and load the generated extension into Chrome.
- **Candidate dashboard:** `frontend/web-dashboard` is the Next.js website. Deploy this app to Vercel if `job.progeni.live` is meant to open the candidate workspace.

### Build and load the extension locally

From the repository root in PowerShell:

```powershell
cd .\frontend\chrome-extension
npm ci
npm run typecheck
npm run build
```

In Chrome, go to `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `frontend\chrome-extension\dist`. Keep this generated `dist` folder intact: it contains the extension manifest, popup, side panel, service worker, and content scripts. For Chrome Web Store submission, ZIP the **contents** of `dist` (including `manifest.json` at the ZIP root), not the repository or a Vercel deployment.

### Deploy the candidate dashboard to Vercel

Create a separate Vercel project for the website using the `vivekanandkumar001/Progeni_job_ext` Git repository:

1. In Vercel, select **Add New → Project** and import the repository.
2. Set **Root Directory** to `frontend/web-dashboard` (without a leading slash). Do not choose `frontend/chrome-extension`, `frontend/admin-panel`, or `backend`.
3. Use the detected **Next.js** framework and the defaults for install command, build command (`next build` / `npm run build`), and output directory.
4. Deploy and wait for the deployment to become **Ready**.
5. In this dashboard project, open **Settings → Domains** and add `job.progeni.live`. If that domain is still assigned to the Chrome-extension Vercel project, remove it from that project first, then assign it here. Apply the DNS records Vercel requests and wait for domain verification and TLS.
6. Keep the extension as a separate local/Chrome Web Store build; it does not need its own Vercel project or domain.

If Vercel already imported `frontend/chrome-extension`, you can leave that project undeployed or remove it. In Vercel project settings, change **Root Directory** to `frontend/web-dashboard`, or create a separate dashboard project with that root. A `vercel.json` at the repository root is not needed for this monorepo setup.

### How the local pieces connect

```text
Chrome extension ──┐
                   ├── HTTP ──> Express backend at 127.0.0.1:5000
Dashboard on       ┘            local JSON data in %LOCALAPPDATA%\ProgeniAutoApply
http://localhost:3000
```

For local development, start the backend and dashboard using the steps below, then load the extension in Chrome. Both the extension and the local dashboard use the local API at `http://127.0.0.1:5000/api/v1/local`; the extension requests access to that loopback host in its manifest. The backend only exposes this local candidate API in development and binds to loopback.

**Vercel-hosted dashboard limitation:** deployment makes the website reachable, but it does not deploy or connect the local Express backend. In a visitor’s browser, `127.0.0.1` refers to that visitor’s own computer; HTTPS browser security also restricts calls from a public site to a local HTTP service. Thus the deployed site is not a working shared candidate workspace with the current API. For a public service, deploy a production API and persistent, access-controlled storage, then configure the dashboard API URL, backend CORS allowlist, authentication, and extension host permissions to use that secured API. Do not expose the development local API or its JSON data file to the internet.

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

Open [http://localhost:3000](http://localhost:3000). The home page redirects to `/dashboard`. Accept the local-data notice before entering profile or job information.

### 3. Build and load the Chrome extension

```powershell
cd .\frontend\chrome-extension
npm install
npm run build
```

In Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select:

```text
.\frontend\chrome-extension\dist
```

Open a supported Naukri, LinkedIn, or Indeed job page and use the extension. Refresh a job page if it was already open when the extension was loaded. The content script reads job details only when you choose **Detect this job**. Profile data, extracted job details, match results, and tracker entries are stored by the local backend.

## What this MVP does and does not do

- Matching is deterministic and explainable. It compares user-entered profile skills and experience with details provided for a job; it is not an AI assessment or hiring probability.
- Skills mentioned in a job description are not assumed to be mandatory qualifications. Missing profile or job information is reported as unknown.
- Profile-based application details are suggestions for the candidate to review and copy manually. Subjective and sensitive screening questions are left to the candidate.
- Resume intelligence parses PDF, DOCX, and UTF-8 text files locally (maximum 5 MB). It suggests contact details, explicit experience statements, and skills from a fixed catalog with short matching text snippets. Candidates review and confirm all details. Scanned PDFs require OCR, which is not included.
- The original resume and full extracted text are not retained. Confirmed profile fields and short skill-evidence snippets are stored in the local workspace. Remove a resume record to remove its evidence snippets; confirmed profile fields remain until edited or the workspace is cleared.
- Tracker statuses are self-reported. A “submitted” status does not verify that a job site received an application.
- Application submission, CAPTCHA/OTP handling, and bypassing website controls are not implemented.
- AI-provider integration, job recommendations, interview coaching, analytics, and the admin interface are not part of this candidate MVP.

## Privacy and release readiness

The local dashboard and extension require explicit consent before using candidate data. Use **Privacy & data** in the dashboard to clear the local workspace and withdraw consent. The local JSON file is **not encrypted at the application layer**; use only for local development on a trusted device. This build is not ready for production deployment or Chrome Web Store release.

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
