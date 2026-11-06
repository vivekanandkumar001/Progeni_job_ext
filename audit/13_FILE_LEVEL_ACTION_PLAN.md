# 13. File-by-File Developer Action & Implementation Plan

> **Document ID:** `AUDIT-13-FILE-PLAN`  
> **Target Audience:** Core Engineering Team & Lead Developers  
> **Auditor:** Forensic Engineering & Implementation Architecture Team  
> **Date:** November 2026

---

## 1. Action Plan Taxonomy

Every file marked for engineering action is classified under one of the following directives:
- `CREATE`: New file required to implement missing functionality or infrastructure.
- `REPLACE`: Existing placeholder or stub file must be completely rewritten.
- `MODIFY`: Existing functional file requires specific targeted enhancements or bug fixes.
- `VERIFY`: Existing file is functional and verified; requires regression testing only.

---

## 2. Backend Subsystem (`backend/`)

| Action | Relative File Path | Purpose & Scope of Changes | Verification Command |
|---|---|---|---|
| `MODIFY` | `src/server.ts` | Replace in-memory `express-rate-limit` with Redis-backed store (`rate-limit-redis`). Add structured HTTP request logger (`pino-http`). | `npm test` & load test |
| `MODIFY` | `src/config/env.ts` | Add environment variables for `REDIS_URL`, `SENTRY_DSN`, and `REMOTE_SELECTOR_URL` with Zod validation. | `npx tsc --noEmit` |
| `CREATE` | `src/routes/selectors.ts` | Create REST endpoint `GET /api/v1/selectors` returning versioned ATS selector definitions. | `npm test test/selectors.test.ts` |
| `CREATE` | `src/migrations/001_initial_indexes.ts` | Declarative migration script creating compound indexes for `applications`, `resumes`, and `jobs`. | `npx migrate-mongo up` |
| `MODIFY` | `src/services/mongoWorkspaceStore.ts` | Wrap dual-model writes (`candidate_workspaces` + `candidate_profiles`) inside an atomic MongoDB ClientSession transaction. | `npm test` |
| `MODIFY` | `src/services/resumeParser.ts` | Add OCR fallback integration using `tesseract.js` when text length extracted by `pdf-parse` is $< 50$ characters. | `npm test test/resumeParser.test.ts` |
| `MODIFY` | `src/services/answerEngine.ts` | Add support for Indian notice periods and multiple citizenship records in candidate workspace grounding. | `npm test test/answerEngine.test.ts` |

---

## 3. Candidate Web Dashboard (`frontend/web-dashboard/`)

| Action | Relative File Path | Purpose & Scope of Changes | Verification Command |
|---|---|---|---|
| `REPLACE` | `app/(candidate)/application-details/page.tsx` | Replace 1-line demo stub with dynamic view rendering application timeline, matched resume, and notes editor. | `npm run build` |
| `REPLACE` | `app/(candidate)/interview-center/page.tsx` | Replace demo stub with behavioral and technical Q&A preparation interface connected to matched JD facts. | `npm run build` |
| `REPLACE` | `app/(candidate)/interview-preparation/page.tsx` | Replace demo stub with mock interview simulator and audio/text self-recording review. | `npm run build` |
| `REPLACE` | `app/(candidate)/skill-gap-analyzer/page.tsx` | Replace demo stub with interactive skill visualization comparing candidate profile against target market roles. | `npm run build` |
| `REPLACE` | `app/(candidate)/learning-roadmap/page.tsx` | Replace demo stub with structured learning recommendation path based on missing job skills. | `npm run build` |
| `REPLACE` | `app/(candidate)/job-recommendations/page.tsx` | Replace demo stub with ranked opportunity feed populated from `GET /api/v1/matches`. | `npm run build` |
| `REPLACE` | `app/(candidate)/notifications/page.tsx` | Replace demo stub with notification center tracking status changes and new matching roles. | `npm run build` |
| `REPLACE` | `app/(candidate)/onboarding/page.tsx` | Replace demo stub with 3-step candidate onboarding wizard (Profile Setup -> Resume Upload -> Extension Install). | `npm run build` |
| `REPLACE` | `app/(candidate)/performance-analytics/page.tsx` | Replace demo stub with metrics charts (Application Velocity, Match Ratio, Interview Conversion Rate). | `npm run build` |
| `REPLACE` | `app/(candidate)/application-review/page.tsx` | Replace demo stub with pre-submission inspection card displaying filled vs manual fields. | `npm run build` |
| `REPLACE` | `app/(candidate)/current-job-detection/page.tsx` | Replace demo stub with active tab detection status synced with Chrome extension. | `npm run build` |
| `REPLACE` | `app/(candidate)/follow-up-manager/page.tsx` | Replace demo stub with follow-up reminder scheduler for submitted applications. | `npm run build` |
| `REPLACE` | `app/(candidate)/job-match-intelligence/page.tsx` | Replace demo stub with in-depth match breakdown inspector displaying scoring weights. | `npm run build` |
| `REPLACE` | `app/(candidate)/strengths-and-weaknesses/page.tsx`| Replace demo stub with candidate competency summary derived from verified resume evidence. | `npm run build` |
| `MODIFY` | `lib/api.ts` | Add client methods for `getSelectors()`, `getInterviewPrep()`, and `getNotifications()`. | `npx tsc --noEmit` |

---

## 4. Admin Operations Console (`frontend/admin-panel/`)

| Action | Relative File Path | Purpose & Scope of Changes | Verification Command |
|---|---|---|---|
| `REPLACE` | `app/dashboard/page.tsx` | Replace 15-line demo stub with live metric cards (Active Candidates, Total Matches, Daily Submissions). | `npm run build` |
| `REPLACE` | `app/user-management/page.tsx` | Replace demo stub with paginated candidate table with search, role editing, and account deletion. | `npm run build` |
| `REPLACE` | `app/platform-adapter-management/page.tsx` | Replace demo stub with ATS telemetry view displaying success/failure rates across Greenhouse, Lever, etc. | `npm run build` |
| `REPLACE` | `app/compliance-automation-policy/page.tsx` | Replace demo stub with compliance audit log showing candidate consent timestamps and manual review events. | `npm run build` |
| `REPLACE` | `app/analytics-reports/page.tsx` | Replace demo stub with cohort retention and application funnel conversion reports. | `npm run build` |
| `REPLACE` | `app/support-reports/page.tsx` | Replace demo stub with candidate issue triage view for reporting broken ATS selectors. | `npm run build` |
| `REPLACE` | `app/system-settings-monitoring/page.tsx` | Replace demo stub with system health console (API latency, MongoDB connection pool metrics). | `npm run build` |
| `REPLACE` | `app/login/page.tsx` | Replace demo stub with administrative login view enforcing `role === 'admin'`. | `npm run build` |

---

## 5. Chrome Extension Subsystem (`frontend/chrome-extension/`)

| Action | Relative File Path | Purpose & Scope of Changes | Verification Command |
|---|---|---|---|
| `CREATE` | `src/content/ats/remoteRegistry.ts` | Remote selector client that fetches updated ATS CSS selectors from the backend with offline fallback. | `npm run build` |
| `MODIFY` | `src/background/service-worker.ts` | Add listener for `chrome.webNavigation.onHistoryStateUpdated` to detect URL changes in Single Page Applications. | `npm run build` |
| `MODIFY` | `src/content/ats/greenhouseAdapter.ts` | Wire into remote selector registry and add support for multi-step application wizards. | `npm test test/atsAdapters.test.ts` |
| `MODIFY` | `src/content/ats/leverAdapter.ts` | Wire into remote selector registry and improve custom question text extraction. | `npm test test/atsAdapters.test.ts` |
| `MODIFY` | `src/sidepanel/SidePanel.tsx` | Add multi-step progress stepper and visual highlighting of fields requiring manual candidate entry. | `npm run build` |

---

## 6. Infrastructure & CI/CD Pipeline

| Action | Relative File Path | Purpose & Scope of Changes | Verification Command |
|---|---|---|---|
| `CREATE` | `.github/workflows/ci.yml` | GitHub Actions workflow executing `npm test`, `npm run lint`, and `npm run build` across all 4 packages. | Trigger PR build |
| `CREATE` | `docker-compose.yml` | Local orchestration file spinning up MongoDB replica set and Redis instance for development. | `docker compose up -d` |
| `MODIFY` | `README.md` | Update developer setup guide documenting new Redis requirements and App Router views. | Documentation review |

