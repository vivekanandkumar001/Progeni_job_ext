# Audit Report 01: Complete Repository Inventory & Dependency Map

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-06  
**Auditor:** Principal Software Architect & QA Automation Lead

---

## 1. Directory Tree & Application Structure

The repository contains four distinct applications/modules across backend, frontend, and browser extension:

```text
auto apply extention/
├── .env.example                                  # Backend environment variable template
├── .gitignore                                     # Global git ignore definitions
├── package.json (absent at root)                 # No root workspace package.json; isolated packages
├── vercel.json                                   # Multi-service edge routing definitions
│
├── audit/                                        # Master forensic audit deliverable suite (14 files)
│
├── backend/                                      # Express API Service
│   ├── dist/                                     # Compiled JavaScript build output
│   ├── src/
│   │   ├── config/                               # env.ts, mongodb.ts, supabase/client.ts
│   │   ├── controllers/                          # applications.ts, candidateProfile.ts, jobs.ts, matches.ts, resume.ts
│   │   ├── middlewares/                          # auth.ts, errorHandler.ts
│   │   ├── routes/                               # applications.ts, candidateProfile.ts, jobs.ts, localMvp.ts, matches.ts, resume.ts
│   │   ├── services/                             # answerEngine.ts, applicationEngine.ts, candidateProfileService.ts, jobService.ts,
│   │   │                                         # localDataStore.ts, matchingEngine.ts, matchService.ts, mongoWorkspaceStore.ts,
│   │   │                                         # resumeParser.ts, resumeService.ts
│   │   ├── applicationService.ts                 # Legacy application collection storage & idempotency
│   │   └── server.ts                             # Express server entry point & route mounts
│   ├── test/                                     # Automated test suite (32 unit & integration tests)
│   ├── package.json                              # auto-apply-backend@1.0.0
│   ├── package-lock.json
│   └── tsconfig.json
│
├── frontend/
│   ├── web-dashboard/                            # Next.js 15 Candidate Web Dashboard
│   │   ├── app/
│   │   │   ├── (candidate)/                      # Candidate App Router group
│   │   │   │   ├── application-assistant/        # Functional profile-guided answer preparation
│   │   │   │   ├── application-tracker/          # Functional application ledger & status updater
│   │   │   │   ├── candidate-profile/            # Functional profile editor & skills manager
│   │   │   │   ├── dashboard/                    # Functional overview, quick match & job entry
│   │   │   │   ├── resume-manager/               # Functional resume upload, parse review & version store
│   │   │   │   ├── settings-privacy/             # Functional consent display & workspace clearing
│   │   │   │   ├── layout.tsx                    # Shared candidate shell & navigation bar
│   │   │   │   └── [14 demo placeholder pages]  # 200-byte demo screens marked [DEMO DATA]
│   │   │   ├── auth/callback/[flow]/route.ts     # Supabase PKCE OAuth/signup callback handler
│   │   │   ├── login/page.tsx                    # Candidate authentication (sign-in & sign-up)
│   │   │   ├── privacy/page.tsx                  # Public data privacy notice
│   │   │   ├── reset-password/page.tsx           # Password recovery request & update
│   │   │   ├── globals.css                       # Design token stylesheet (Material Design 3 tokens)
│   │   │   └── layout.tsx & page.tsx             # Root layout and redirect
│   │   ├── lib/                                  # api.ts (REST client & Supabase), data.ts (demo fallbacks)
│   │   ├── middleware.ts                         # Edge authentication & cookie refresh guard
│   │   ├── .eslintrc.json                        # ESLint next/core-web-vitals configuration
│   │   ├── package.json                          # @progeni/web@0.1.0
│   │   └── tsconfig.json
│   │
│   ├── chrome-extension/                         # Manifest V3 Chrome Extension
│   │   ├── dist/                                 # Vite/CRXJS production build artifacts
│   │   ├── src/
│   │   │   ├── background/
│   │   │   │   └── service-worker.ts             # MV3 background worker, tab messaging, Supabase token storage
│   │   │   ├── content/
│   │   │   │   ├── ats/                          # Modular ATS Adapter Registry (8 platform adapters)
│   │   │   │   ├── adapter-detector.ts           # On-demand DOM detector export
│   │   │   │   ├── content.ts                    # Injected content script listener
│   │   │   │   └── jobAdapter.ts                 # Registry integration & skill extraction bridge
│   │   │   ├── popup/                            # Popup interface (HTML, TSX, CSS)
│   │   │   ├── sidepanel/                        # Side panel interface (HTML, TSX)
│   │   │   └── shared/messages.ts                # Typed runtime message envelopes & keys
│   │   ├── manifest.json                         # MV3 manifest with scoped host permissions
│   │   ├── package.json                          # @progeni/extension@0.1.0
│   │   ├── tsconfig.json
│   │   └── vite.config.ts                        # Vite + React + CRXJS plugin configuration
│   │
│   └── admin-panel/                              # Next.js 15 Admin Prototype
│       ├── app/
│       │   ├── dashboard/page.tsx                # Static metrics grid [DEMO DATA]
│       │   ├── login/page.tsx                    # Static admin login placeholder
│       │   └── [6 secondary demo pages]          # Analytics, compliance, adapters, support, monitoring, users
│       ├── .eslintrc.json                        # ESLint next/core-web-vitals configuration
│       ├── package.json                          # @progeni/admin@0.1.0
│       └── tsconfig.json
```

---

## 2. Package Dependency Mapping

### A. `backend/package.json`
- **Name / Version**: `auto-apply-backend@1.0.0`
- **Type**: `commonjs`
- **Production Dependencies**:
  - `@napi-rs/canvas@^0.1.100`: Canvas graphics engine (unused in live routes; available for PDF rendering)
  - `@supabase/supabase-js@^2.46.1`: Supabase authentication token verification client
  - `cors@^2.8.5`: Express cross-origin resource sharing middleware
  - `dotenv@^16.4.5`: Environment variable loader
  - `express@^4.21.1`: Core HTTP REST routing framework
  - `helmet@^8.0.0`: Security HTTP response header suite
  - `jsonwebtoken@^9.0.2`: HS256 JWT signing for local development sessions
  - `mammoth@^1.13.0`: DOCX document raw text extractor
  - `mongodb@^7.8.0`: Official MongoDB native driver (replica set connection pooling)
  - `pdf-parse@^2.4.5`: Binary PDF document text extractor
  - `zod@^4.6.7`: Schema parsing and input validation
- **Dev Dependencies**:
  - `@types/cors`, `@types/express`, `@types/jsonwebtoken`, `@types/node`: TypeScript type definitions
  - `tsx@^4.19.2`: TypeScript execution and native test runner (`tsx --test`)
  - `typescript@^5.6.3`: Compiler (`tsc`)
- **Vulnerability Status**: **0 vulnerabilities** (`npm audit`).

### B. `frontend/web-dashboard/package.json`
- **Name / Version**: `@progeni/web@0.1.0`
- **Private**: `true`
- **Production Dependencies**:
  - `@supabase/ssr@^0.12.7`: Next.js App Router cookie-based Supabase session client
  - `@supabase/supabase-js@^2.118.0`: Supabase JavaScript SDK
  - `lucide-react@^0.454.0`: Icon library for dashboard UI
  - `next@15.5.28`: React framework (App Router, Edge Middleware, Static Optimizer)
  - `react@^18.3.1`, `react-dom@^18.3.1`: React 18 UI library
- **Dev Dependencies**:
  - `autoprefixer@^10.4.20`, `postcss@^8.5.23`, `tailwindcss@^3.4.14`: Tailwind CSS pipeline
  - `eslint@^8.57.0`, `eslint-config-next@15.0.0`: Linter and Next.js rules
  - `typescript@^5.6.3`: Compiler (`tsc --noEmit`)
- **Overrides**: `postcss@^8.5.23`
- **Vulnerability Status**: **0 vulnerabilities** (`npm audit`).

### C. `frontend/chrome-extension/package.json`
- **Name / Version**: `@progeni/extension@0.1.0`
- **Private**: `true`
- **Type**: `module`
- **Production Dependencies**:
  - `@supabase/supabase-js@^2.118.0`: Chrome extension Supabase client (persists to `chrome.storage.local`)
  - `react@^18.3.1`, `react-dom@^18.3.1`: React UI for popup and side panel
- **Dev Dependencies**:
  - `@crxjs/vite-plugin@^2.0.0-beta.25`: Vite plugin for Chrome Manifest V3 extension bundling
  - `@types/chrome@^0.0.279`: Chrome Extension API TypeScript definitions
  - `@vitejs/plugin-react@^4.3.3`: Vite React HMR and JSX compiler
  - `typescript@^5.6.3`: Compiler
  - `vite@^5.4.10`: Build tool and dev server
- **Vulnerability Status**: **2 dev-toolchain vulnerabilities** (esbuild moderate, vite high; dev server only).

### D. `frontend/admin-panel/package.json`
- **Name / Version**: `@progeni/admin@0.1.0`
- **Private**: `true`
- **Production Dependencies**:
  - `lucide-react@^0.454.0`: Icons
  - `next@15.5.28`: React framework
  - `react@^18.3.1`, `react-dom@^18.3.1`: React UI
- **Dev Dependencies**:
  - `autoprefixer`, `postcss`, `tailwindcss`: Tailwind CSS pipeline
  - `eslint@^8.57.0`, `eslint-config-next@15.0.0`: Linter
  - `typescript@^5.6.3`: Compiler
- **Vulnerability Status**: **0 vulnerabilities** (`npm audit`).

---

## 3. Codebase Metrics & Language Breakdown

- **Total Source Files (excluding node_modules, .next, dist, .git)**: 82 files
- **Primary Languages**:
  - TypeScript (`.ts`, `.tsx`): ~88% of application logic
  - Markdown documentation (`.md`): ~8%
  - JSON configuration (`package.json`, `tsconfig.json`, `manifest.json`): ~3%
  - CSS (`globals.css`, `popup.css`): ~1%
- **Code Health Indicators**:
  - TODO / FIXME comments: **0** in application code
  - ESLint warnings / errors: **0** across dashboard and admin panel
  - TypeScript compilation errors: **0** across all 4 packages
  - Automated tests passing: **32 of 32 (100%)**

---

## 4. Dead Code, Disconnected Modules, and Placeholder Inventory

### A. The 14 Candidate Demo Placeholder Pages
Located in `frontend/web-dashboard/app/(candidate)/`:
1. `application-details/page.tsx` (237 bytes)
2. `application-review/page.tsx` (236 bytes)
3. `current-job-detection/page.tsx` (239 bytes)
4. `follow-up-manager/page.tsx` (235 bytes)
5. `interview-center/page.tsx` (234 bytes)
6. `interview-preparation/page.tsx` (239 bytes)
7. `job-match-intelligence/page.tsx` (240 bytes)
8. `job-recommendations/page.tsx` (237 bytes)
9. `learning-roadmap/page.tsx` (234 bytes)
10. `notifications/page.tsx` (231 bytes)
11. `onboarding/page.tsx` (228 bytes)
12. `performance-analytics/page.tsx` (239 bytes)
13. `skill-gap-analyzer/page.tsx` (236 bytes)
14. `strengths-and-weaknesses/page.tsx` (242 bytes)

*Pattern observed in all 14 files*:
```typescript
export default function Page() {
  return (
    <div className='p-6'>
      <h1 className='text-2xl font-semibold'>interview-center</h1>
      <p className='text-sm text-on-surface-variant mt-2'>[DEMO DATA] Progeni AutoApply candidate screen</p>
    </div>
  );
}
```

### B. Admin Panel Demo Placeholder Pages
Located in `frontend/admin-panel/app/`:
1. `dashboard/page.tsx`: Renders hardcoded numbers (Adapters: 4, Users: --, Applications: --) marked `[DEMO DATA]`.
2. `login/page.tsx`: Static placeholder div marked `[DEMO DATA] Admin screen - no private candidate PII exposed`.
3. `analytics-reports/page.tsx`, `compliance-automation-policy/page.tsx`, `platform-adapter-management/page.tsx`, `support-reports/page.tsx`, `system-settings-monitoring/page.tsx`, `user-management/page.tsx`: All single-line demo divs.

### C. Unused Backend Dependencies
- `@napi-rs/canvas`: Installed in `backend/package.json` for potential server-side image/PDF generation, but never imported in any live server route or service.
- `localSessionRoutes`: Mounted on `/session` inside `/api/v1/local`; used only in local development loopback mode, dead in cloud production.

### D. Unconnected Vercel Service
- In [`vercel.json`](./vercel.json), `admin-panel` is declared under `services` (lines 10-13), but lines 25-56 define rewrites only for `backend` and `web-dashboard`. The admin panel is completely unexposed to web traffic.

