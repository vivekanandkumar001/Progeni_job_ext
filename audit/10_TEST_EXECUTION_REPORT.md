# 10. Test Execution, Verification & Build Quality Report

> **Document ID:** `AUDIT-10-TEST-REPORT`  
> **Target Subsystems:** Backend API, Web Dashboard, Chrome Extension, Admin Panel  
> **Test Framework:** Node.js Native Test Runner (`node:test` + `tsx`)  
> **Auditor:** Forensic QA & Test Automation Engineering Team  
> **Date:** November 2026

---

## 1. Test Suite Summary & Global Verification Scorecard

| Package | Test Command | Total Tests | Passed | Failed | Skipped | Pass Rate | Build Status |
|---|---|---|---|---|---|---|---|
| **`backend`** | `npm test` (`tsx --test test/*.test.ts`) | **32** | **32** | 0 | 0 | **100%** | `PASSED` (`tsc`) |
| **`frontend/web-dashboard`** | `npm run lint` & `npm run build` | Static Analysis | All Rules | 0 | 0 | **100%** | `PASSED` (Next.js 15) |
| **`frontend/chrome-extension`** | `npm run build` | Bundle Check | Vite Build | 0 | 0 | **100%** | `PASSED` (Vite 5 / MV3) |
| **`frontend/admin-panel`** | `npm run lint` & `npm run build` | Static Analysis | All Rules | 0 | 0 | **100%** | `PASSED` (Next.js 15) |

---

## 2. Backend Automated Test Suite Execution Log

Executed via `npm test --prefix backend`:
```
> auto-apply-backend@1.0.0 test
> tsx --test test/*.test.ts

✔ classifyQuestion correctly identifies screening question intent (4.89ms)
✔ generateGroundedAnswer extracts exact candidate details with confidence 1.0 (0.81ms)
✔ generateGroundedAnswer provides experience years grounded in profile (0.23ms)
✔ generateGroundedAnswer verifies skill presence with resume evidence (0.52ms)
✔ generateGroundedAnswer strictly refuses to hallucinate visa/authorization answers (2.11ms)
✔ generateGroundedAnswer strictly refuses to fabricate salary expectations (0.76ms)
✔ generateGroundedAnswer refuses to hallucinate subjective behavioral answers (2.44ms)
✔ generateGroundedAnswer handles null profile gracefully (0.28ms)
✔ upsertProfile controller rejects invalid payload (e.g. invalid email or negative experience) (21.21ms)
✔ createJob controller rejects invalid job payload (e.g. missing title) (15.51ms)
✔ calculateMatch controller rejects out-of-bounds factor scores (> 100) (18.08ms)
✔ transitionApplication controller rejects invalid transition target status (2.06ms)
✔ transitionStatus allows valid progressive status transitions (3.50ms)
✔ transitionStatus blocks invalid illegal status jumps (0.46ms)
✔ transitionStatus rejects transition for nonexistent application (0.24ms)
✔ transitionStatus rejects transition attempted by wrong user ID (IDOR prevention) (0.24ms)
✔ ATS Registry correctly identifies supported platforms by URL (2.32ms)
✔ Greenhouse adapter extracts job details and detects application form fields (0.74ms)
✔ Lever adapter extracts job details and detects form fields (0.58ms)
✔ Workday adapter enforces manual review and refuses blind auto-fill (0.23ms)
✔ calculateMatchScore returns 0 and explanation when factors are empty (5.26ms)
✔ calculateMatchScore averages factors and clamps between 0 and 100 (0.51ms)
✔ calculateMatchScore flags non-numeric factors as missingEvidence (0.40ms)
✔ checkHardEligibility passes when all mandatory skills and experience are met (0.49ms)
✔ checkHardEligibility flags blockers when mandatory skills or experience are lacking (0.27ms)
✔ checkHardEligibility flags unknowns when candidate experience or skills are missing (0.20ms)
✔ requires a verified user ID before checking consent (1.53ms)
✔ blocks candidate access when consent has not been accepted (1.47ms)
✔ forwards consent-store errors to Express error handling (0.44ms)
✔ analyzeResume throws on empty file buffer (4.34ms)
✔ analyzeResume throws on corrupted or non-PDF buffer (0.55ms)
✔ analyzeResume extracts candidate data from plain text file (112.51ms)

ℹ tests 32
ℹ suites 0
ℹ pass 32
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3893
```

---

## 3. Detailed Test Module Breakdown

### 3.1 Explainable Answer Engine Tests (`test/answerEngine.test.ts`)
- **Intent Classification:** Validates correct categorization across contact information, legal work authorization, compensation, and availability.
- **Fact Retrieval:** Verifies that verified profile facts return with confidence `1.0` and exact `sourceField` attribution.
- **Negative Assertion & Zero Hallucination:** Explicitly asserts that visa sponsorship, salary expectations, and open-ended subjective essays return `manual_input_required` with `suggestedAnswer === null`.

### 3.2 Request Controller Validation & IDOR Tests (`test/controllers.test.ts`)
- **Input Boundaries:** Verifies that Zod schemas reject malformed email strings, negative years of experience, missing job titles, and factor scores $> 100$.
- **IDOR Access Control:** Verifies that attempting an application stage transition with mismatched user credentials throws an unauthorized rejection error.
- **State Machine Integrity:** Confirms valid stage transitions (`discovered -> prepared -> submitted -> interview`) while preventing illegal state jumps.

### 3.3 ATS Adapter Suite (`test/atsAdapters.test.ts`)
- **Registry Platform Resolution:** Validates detection for Greenhouse, Lever, Ashby, Workday, SmartRecruiters, LinkedIn, Indeed, and Naukri URLs.
- **Greenhouse & Lever Parsing:** Verifies field identification for first name, last name, email, phone, and resume inputs against mock DOM trees.
- **Workday Safeguard:** Asserts that Workday adapter strictly returns `canAutoFill() === false` and `requiresManualReview() === true`.

### 3.4 Matching Engine & Eligibility Tests (`test/matchingEngine.test.ts`)
- **Scoring Normalization:** Tests clamp boundaries ($[0, 100]$), factor averaging, and missing evidence identification.
- **Hard Eligibility Gatekeeper:** Validates that missing mandatory skills or deficient years of experience create blocking items and invalidate candidate eligibility.

### 3.5 Consent & Resume Parsing Tests (`test/consentMiddleware.test.ts` & `test/resumeParser.test.ts`)
- **Privacy Enforcement:** Confirms that candidate endpoints reject access until data consent is explicitly recorded.
- **Buffer Safety:** Verifies that corrupt or empty resume uploads trigger graceful error handling rather than unhandled process crashes.

---

## 4. Historical Bug Fixes Verified in Codebase

During previous development and audit runs, five critical bugs were resolved and verified by the test suite:
1. **Route Deadlock on `POST /api/v1/jobs`:** Resolved race condition and duplicate middleware wrapping in `backend/src/server.ts` and `routes/jobs.ts`.
2. **Redundant Middleware Stacking:** Removed duplicate `authMiddleware` calls across legacy routers.
3. **Zod v4 Schema Typing:** Corrected `z.record()` definitions to `z.record(z.string(), z.unknown())` for compatibility with modern Zod typing.
4. **Regex Boundary Widening:** Updated experience regex in `answerEngine.ts` to capture phrasing like *"Total years of professional experience"*.
5. **Selector Mocking Parser:** Refactored mock DOM query selector in `atsAdapters.test.ts` to split comma-separated CSS selectors correctly.

---

## 5. Test Coverage Gaps & Remediation Priorities

1. **End-to-End Browser Automation Tests:** Extension popup and side panel interactions currently lack headless Playwright tests.
2. **Live Third-Party ATS Mock Fixtures:** Test suite uses in-memory DOM mocks; should be supplemented with live HTML snapshot fixtures captured from actual Greenhouse and Lever job pages.
3. **Frontend Integration Tests:** The 7 connected views in `web-dashboard` need Vitest + React Testing Library suites to verify form submissions and error banners.

