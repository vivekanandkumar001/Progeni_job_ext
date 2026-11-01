# Progeni AutoApply

Progeni AutoApply is a Chrome extension with a local candidate dashboard and backend. It helps candidates maintain a career profile, analyze resumes for reviewable details and skill evidence, detect or enter jobs, review explainable matches, prepare application answers, and track their job search. It does not submit applications.

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

The extension can be built independently. Resume analysis and the shared candidate workspace require the local backend; the dashboard is an optional companion.
