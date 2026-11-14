# Progeni AutoApply — Product Gap Analysis

## Critical Issues (P0)

### 1. No Real-Time Notification Delivery
- **Status**: ❓ Unverified — UI exists for notifications but delivery mechanism unclear
- **Evidence**: Notification types listed (job matches, application updates, interview reminders, follow-up reminders, resume alerts, account/security alerts) but no WebSocket or polling implementation visible
- **Impact**: Candidates cannot be notified of important events in real-time
- **Fix Required**: Implement notification delivery system (WebSocket, server-sent events, or periodic polling)

### 2. Application Assistant Extension Requires Manual Pairing
- **Status**: 🟡 Partially Implemented — Chrome extension MV3 framework exists but requires pairing code flow
- **Evidence**: Extension side panel, pairing code generation, zero-secret linking UI all present; but actual autofill and submission automation limited by human approval gate
- **Impact**: Candidates cannot fully automate application process; must manually pair extension and approve each submission
- **Fix Required**: Document the explicit human approval requirements; may need to simplify pairing flow

### 3. Billing/Subscription Functionality Unclear
- **Status**: ⚪ Not Implemented — PRO badge visible in UI but no backend payment integration observed
- **Evidence**: `billing.ts` and `adminBilling.ts` routes exist; `Plans & Billing` page shows PRO badge; but no Stripe integration, no payment processing, no invoice generation, no subscription management visible
- **Impact**: Inability to monetize the product; unclear what PRO features are actually unlocked
- **Fix Required**: Either implement full billing system or remove PRO badge and clarify free-tier limitations

### 4. Missing Critical Feature: Email/SMS Communication
- **Status**: ❓ Unverified — Follow-up Manager can log actions but cannot send actual emails
- **Evidence**: Follow-up Manager has action descriptions (email/LinkedIn) and notes field, but no email service integration visible; no SMTP, no SendGrid, no actual message sending
- **Impact**: Follow-up management is purely task-tracking, not actual communication
- **Fix Required**: Either integrate email service or rebrand follow-up manager as "task tracking only"

### 5. Duplicate Application Detection Not Implemented
- **Status**: ❓ Unverified — Application Tracker allows status transitions but no logic to prevent duplicate applications
- **Evidence**: No code path found for duplicate detection; user can potentially add same job multiple times
- **Impact**: Inflated application counts, misleading analytics
- **Fix Required**: Add duplicate detection logic when saving applications or transitioning statuses

---

## High-Priority Issues (P1)

### 6. ATS Diagnostics Disclaimer Concerns
- **Status**: ✅ Implemented but warrants attention
- **Finding**: Disclaimer correctly states "No third-party ATS exposes public scoring APIs; do not treat any score as an external platform guarantee"
- **Concern**: Users may misinterpret the heuristic score as an actual employer ATS score
- **Recommendation**: Enhance disclaimer visibility; consider adding "This is an internal algorithmic heuristic, not an employer ATS score"

### 7. Truth Engine Dependence on User-Marked Evidence
- **Status**: 🟡 Partially Implemented
- **Finding**: Truth Engine requires users to explicitly register claims and add evidence sources; not auto-extracted from all resume data
- **Impact**: Candidates with unstructured resumes or who don't register claims get weaker match scores
- **Recommendation**: Make claim extraction from resumes more automatic during upload; reduce manual claim registration burden

### 8. Skill Gap Analyzer Limited to 100 Jobs
- **Status**: ✅ Implemented but with limitation
- **Finding**: `skillGapAnalyzer.analyzeGapsForCandidate()` limits to 100 jobs max (`.limit(100)`)
- **Impact**: May not capture all market demand for niche roles or experienced candidates
- **Recommendation**: Make limit configurable or increase; add pagination for very large job markets

### 9. Interview Simulation Affects Real Status
- **Status**: ⚠️ UI Claim Only
- **Finding**: "It will not affect your real job application status" is stated in UI but not technically verified
- **Impact**: Candidates may worry practice simulations could negatively impact real applications
- **Recommendation**: Add technical disclaimer that simulations are completely isolated from application tracker data

### 10. Extension Supported Portals Limited
- **Status**: ✅ Implemented but limited list
- **Finding**: Supported portals explicitly: Greenhouse, Lever, Ashby, SmartRecruiters, Workday
- **Impact**: Candidates on other job portals (Indeed, LinkedIn company pages, company career pages not on above list) cannot use extension autofill
- **Recommendation**: Add more portal adapters or improve manual import workflow

---

## Medium-Priority Issues (P2)

### 11. No Real-Time Collaboration or Sharing
- **Status**: ⚪ Not Implemented
- **Finding**: No way to share profile/resume with mentors, coaches, or colleagues for feedback within the platform
- **Impact**: Candidates must export files externally for review
- **Recommendation**: Add sharing/invitation feature or improve export + feedback workflow

### 12. Limited Analytics Historical Depth
- **Status**: ⚠️ Partially Implemented
- **Finding**: Analytics display current metrics but historical trend data (week/month/quarter over time) not clearly implemented
- **Impact**: Cannot track progress or seasonality in job search effectiveness
- **Recommendation**: Add time-range filtering to analytics, historical charts

### 12. Resume Parser Catalog Limited to ~50 Skills
- **Status**: ✅ Implemented
- **Finding**: `SKILL_CATALOG` in resumeParser.ts has ~50 pre-defined technical skills
- **Impact**: Skills outside catalog not auto-detected; user must manually add them
- **Recommendation**: Make catalog expandable; add "custom skill" input option

### 14. No Mobile Application
- **Status**: ⚪ Not Implemented
- **Finding**: Web dashboard is desktop-responsive but no native mobile app
- **Impact**: Candidates cannot manage job search from mobile devices
- **Recommendation**: Ensure full mobile responsiveness (already largely done) or consider PWA

### 15. Limited Interview Question Preparation
- **Status**: 🟡 Partially Implemented
- **Finding**: Interview Center has practice simulations and feedback recording, but no bank of common interview questions by role/tech
- **Impact**: Less valuable practice sessions
- **Recommendation**: Add interview question bank by role/technology, or integrate with external question databases

---

## Low-Priority Issues (P3)

### 16. Admin Panel Features Unexplored
- **Status**: ❓ Unverified
- **Finding**: Admin panel exists (`frontend\admin-panel\`) with user management, system monitoring, compliance policies, analytics reports
- **Impact**: Unknown if these are functional or placeholder
- **Recommendation**: Investigate admin panel functionality separately

### 17. CORS Configuration Not Visible
- **Status**: ❓ Unverified
- **Finding**: No CORS configuration observed in source code
- **Impact**: May cause issues in certain deployment configurations
- **Recommendation**: Verify and configure CORS if exposing any APIs externally

### 18. No Automated Test Suite Observed
- **Status**: ❓ Unverified
- **Finding**: `tests/` directory at web-dashboard root, but no test execution evidence found
- **Impact**: No regression testing; changes may break existing functionality
- **Recommendation**: Implement test suite (Jest, React Testing Library, or similar)

### 19. Docker Deployment May Need Configuration
- **Status**: ✅ Present
- **Finding**: `Dockerfile` at root, but environment variable configuration not detailed
- **Impact**: Deployment may require manual env var setup
- **Recommendation**: Document required environment variables for Docker deployment

### 20. Supabase Optional — Local Mode Fully Functional
- **Status**: ✅ Verified
- **Finding**: Architecture supports both cloud (Supabase) and local modes; local mode fully functional without external services
- **Impact**: Good for privacy-conscious users or offline work
- **Recommendation**: Continue supporting local mode; document how to enable/localize

---

## Feature Gaps and Recommendations Summary

| Priority | Gap | Recommendation |
|----------|-----|----------------|
| P0 | No real-time notification delivery | Implement WebSocket or polling-based notification system |
| P0 | Billing/subscription unclear | Either implement full payment system or remove PRO badge |
| P0 | No email/SMS communication | Either integrate email service or rebrand follow-up as task-tracking only |
| P1 | ATS score misinterpretation risk | Enhance disclaimer; clarify this is internal heuristic, not employer ATS |
| P1 | Truth Engine manual claim registration | Automate claim extraction from resume uploads |
| P2 | Limited skill catalog (~50 skills) | Make catalog expandable; add custom skill input |
| P2 | No historical analytics trends | Add time-range filtering and historical charts |
| P3 | Admin panel functionality unknown | Investigate and document admin panel features |
| P3 | No automated test suite | Implement Jest/React Testing Library test suite |