# Progeni AutoApply — Technical Architecture Document

## 1. Frontend Architecture

### 1.1 Framework
- **Next.js 13+** with App Router (`frontend\web-dashboard\app\`)
- **React** with TypeScript for type safety
- **Tailwind CSS** for utility-first styling with custom theme
- **Lucide React** for iconography

### 1.2 Routing System
- File-based routing via Next.js App Router
- Protected routes: Authentication required via Supabase/local auth
- Consent-gated routes: Dashboard and all candidate features require consent acceptance
- Mobile-responsive: Sidebar collapses to drawer on mobile

### 1.3 Sidebar Navigation
- 5 main categories with nested tabs:
  - **Workspace**: Overview, Career Profile, Onboarding Wizard
  - **Intelligence & Jobs**: Jobs & Discovery, Match Intelligence, Skill Gap Analyzer
  - **Resume Studio**: Resume Studio, Resume Upload, ATS Diagnostics, Targeted Resume, Truth Engine
  - **Pipeline & Interviews**: Application Assistant, Application Tracker, Interview Center, Follow-Up Manager
  - **Account & Billing**: Analytics & Rates, Notifications, Plans & Billing, Privacy & Data

### 1.4 Page Components
Each sidebar tab maps to a React page component:

| Tab | Component Path | Key State |
|-----|---------------|-----------|
| Dashboard | `app/(candidate)/dashboard/page.tsx` | profile, applications, matches, onboardingStatus |
| Career Profile | `app/(candidate)/candidate-profile/page.tsx` | profile, completenessScore, missingFields |
| Onboarding Wizard | `app/(candidate)/onboarding/page.tsx` | currentStep, completedSteps, profile, preferences, analysis |
| Jobs & Discovery | `app/(candidate)/job-recommendations/page.tsx` | jobs, savedJobs, tab, search filters |
| Match Intelligence | `app/(candidate)/job-match-intelligence/page.tsx` | matches, summary, activeTab, sortBy |
| Skill Gap Analyzer | `app/(candidate)/skill-gap-analyzer/page.tsx` | data, targetRoles, topMissingSkills |
| Resume Studio | `app/(candidate)/resume-studio/page.tsx` | resumes, activeResume, activeTab, version history |
| Resume Upload | `app/(candidate)/resume-manager/page.tsx` | profile, resumes, analysis, selectedSkills |
| ATS Diagnostics | `app/(candidate)/resume-analyzer/page.tsx` | analysis, overallScore, categories |
| Targeted Resume | `app/(candidate)/targeted-resume/page.tsx` | (to be documented) |
| Truth Engine | `app/(candidate)/truth-engine/page.tsx` | claims, filteredClaims, verification statuses |
| Application Assistant | `app/(candidate)/application-assistant/page.tsx` | workspaces, current, activeTab, readiness |
| Application Tracker | `app/(candidate)/application-tracker/page.tsx` | applications, total, activeFilter, searchQuery |
| Interview Center | `app/(candidate)/interview-center/page.tsx` | interviews, simulations, activeStage, viewMode |
| Follow-Up Manager | `app/(candidate)/follow-up-manager/page.tsx` | followUps, filter, actionItem |
| Analytics & Rates | `app/(candidate)/performance-analytics/page.tsx` | analytics, denominators, stageBreakdown |
| Notifications | `app/(candidate)/notifications/page.tsx` | (to be documented) |
| Plans & Billing | `app/(candidate)/billing/page.tsx` | (to be documented) |
| Privacy & Data | `app/(candidate)/settings-privacy/page.tsx` | userInfo, sessions, mfaStatus |

### 1.5 State Management
- **React Hooks**: useState, useEffect, useCallback, useMemo
- **Local state**: Form inputs, UI interactions, modal states
- **Server data**: Fetch on component mount, re-fetch on dependency changes
- **No global state store** (Redux/Zustand): Data fetched per-page from API

### 1.6 API Client
- `frontend\web-dashboard\lib\api.ts` (referenced in layout.tsx)
- Supabase authentication integration (cloud mode)
- Local backend fallback (local mode)
- Consent checking and authentication state management

### 1.7 Form Validation
- Client-side validation with React state
- Required field marking with `required` attribute
- Email/URL input type validation
- Number input with min/max/step constraints
- Real-time field updates via onChange handlers
- Submit handlers prevent default and call backend APIs

### 1.8 Authentication Flow
1. **Local mode**: Username/password or email-based auth stored locally
2. **Cloud mode**: Supabase OAuth/OAuth2 with session management
3. **Consent requirement**: Before accessing candidate features, user must accept Privacy & Security guardrails
4. **Sign-out**: Clears session, resets auth state to 'required'

### 1.9 Protected Routes
- Layout component checks auth status before rendering children
- If `auth === 'loading'`: Shows connecting spinner
- If `auth === 'required'` or `auth === 'unavailable'`: Shows AuthScreen (login required)
- If `consent !== 'accepted'` and pathname !== '/onboarding': Shows privacy guardrails screen
- Mobile drawer accessible via menu button in header

## 2. Backend Architecture

### 2.1 Runtime
- **Node.js** with TypeScript
- **Express** server (implied by route structure)
- **TypeScript** for type safety across all layers

### 2.2 API Routes (19 routes)
Each route maps to a controller that handles business logic:

| Route | Purpose |
|-------|---------|
| `auth.ts` | Authentication, session management, consent |
| `candidate.ts` | Candidate basic info |
| `candidateProfile.ts` | Profile CRUD, completeness calculation |
| `candidatePreferences.ts` | Desired roles, locations, workplace preferences |
| `jobs.ts` | Job discovery, posting data |
| `matches.ts` | Match scoring, match listing |
| `resume.ts` | Resume upload, analysis, deletion |
| `resumeStudio.ts` | Resume editing, versioning, export |
| `targeted-resume.ts` | Targeted resume generation |
| `truth-engine.ts` | Claim management, verification |
| `application-assistant.ts` | Application workspace management |
| `application-tracker.ts` | Application lifecycle tracking |
| `interviews.ts` | Interview scheduling, simulations |
| `followUps.ts` | Follow-up task management |
| `notifications.ts` | Notification preferences and delivery |
| `billing.ts` | Subscription management |
| `admin.ts` | Administrative functions |
| `adminBilling.ts` | Admin billing operations |
| `analytics.ts` | Analytics data retrieval |

### 2.3 Core Controllers
- **candidateProfile.controller**: Manages profile CRUD, completeness scoring, workspace sync
- **resume.controller**: Handles resume upload, parsing, ATS scoring, deletion
- **match.controller**: Match calculation, listing, summary generation
- **truthEngine.controller**: Claim CRUD, evidence addition, verification status updates
- **applicationAssistant.controller**: Workspace lifecycle, resume/cover letter generation, field mapping, approval
- **applicationTracker.controller**: Status transitions, submission evidence recording, lifecycle status management
- **interview.controller**: Interview listing, simulation launching, feedback recording
- **followUp.controller**: Task listing, action logging, completion tracking
- **billing.controller**: Plan management, payment processing (stripe or similar), feature gating

### 2.4 Middleware
- **auth.ts**: Authentication verification, role-based access control
- **authRateLimiter.ts**: Rate limiting per endpoint
- **requestCorrelation.ts**: Request ID tracking for debugging
- **errorHandler.ts**: Centralized error handling with consistent error format

### 2.5 Authentication & Authorization
- **Supabase integration** for cloud deployments
- **Local fallback** for development/offline mode
- **Role-based access**: Regular users vs. admin users
- **Consent gating**: Data processing and job application assistance consents required before feature activation
- **Session management**: OnAuthStateChange for cloud, local storage for local mode

### 2.6 Background Jobs & Scheduled Tasks
- No explicit background job framework (bull/queue) observed
- All operations are request-response synchronous
- Some operations may be batched during API calls (e.g., loading multiple data sets via Promise.all)

### 2.7 Error Handling
- Consistent error format: `{ message: string }` returned from all services
- Try/catch wrappers around all database operations
- User-facing error messages displayed in UI
- Console/error logging not visible in source but implied

## 3. Database Architecture

### 3.1 Database Provider
- **MongoDB** (MongoDB Atlas referenced in UI)
- Connection via `backend\src\config\mongodb.ts`

### 3.2 Database Collections

#### 3.2.1 `candidate_profiles`
- **Schema**: CandidateProfileRow interface
- **Key fields**: `_id` (userId), `user_id`, `full_name`, `email`, `phone`, `city`, `country`, `target_role`, `experience_level`, `location`, `linkedin_url`, `github_url`, `portfolio_url`, `skills`, `experience_years`, `education`, `work_experience`, `projects`, `certifications`, `resume_completeness`, `created_at`, `updated_at`
- **Purpose**: Core candidate profile data, completeness scoring
- **Relationships**: Owned by user (one profile per user, `_id` = `userId`)

#### 3.2.2 `candidate_onboarding`
- **Schema**: CandidateOnboardingRow interface
- **Key fields**: `id` (userId), `user_id`, `current_step` (1-5), `completed_steps`, `status`, `consents` (data_processing, job_application_assistance), `completed_at`
- **Purpose**: 5-stage onboarding progress tracking
- **Relationships**: One per user

#### 3.2.3 `resumes`
- **Schema**: ResumeDocument / ResumeRow interface
- **Key fields**: `_id`, `user_id`, `title`, `file_name`, `file_type`, `file_size_bytes`, `version`, `parsed_text`, `skills`, `skill_evidence`, `experience_years`, `experience_evidence`, `sections`, `ats_score`, `is_active`, `created_at`, `updated_at`
- **Purpose**: Stored resumes with parsed evidence, one active resume per user
- **Relationships**: Belongs to user; active resume synced to candidate_workspaces

#### 3.2.4 `job_matches`
- **Schema**: DeterministicMatchResult / MatchDocument interface
- **Key fields**: `_id`, `id`, `user_id`, `candidate_id`, `job_id`, `overall_score` (0-100), `dimension_scores`, `eligibility_status`, `matched_skills`, `missing_required_skills`, `missing_preferred_skills`, `skill_details`, `experience_details`, `education_details`, `location_details`, `salary_details`, `blockers`, `unknowns`, `warnings`, `explanation`, `confidence`, `algorithm_version`, `created_at`, `updated_at`, `score`, `factors`, `eligible`
- **Purpose**: Match scores between candidate and discovered jobs
- **Relationships**: Belongs to user; one record per job-candidate pair

#### 3.2.5 `resume_claims`
- **Schema**: ResumeClaim interface
- **Key fields**: `id`, `user_id`, `resume_id`, `category` (skill/experience_years/employment_history/education/certification/project), `claim_text`, `supporting_source` (EvidenceSource), `verification_status` (verified_from_source/candidate_confirmed/unverified/unsupported), `candidate_confirmed`, `confidence_score` (0.0-1.0), `audit_notes`, `created_at`, `updated_at`
- **Purpose**: Truth Engine evidence mapping, claim verification
- **Relationships**: Belongs to user; each claim has verification status and optional evidence source

#### 3.2.6 `candidate_workspaces`
- **Schema**: Internal workspace snapshot
- **Key fields**: `_id` (userId), `data` (profile, resumes, consentAcceptedAt, etc.)
- **Purpose**: Cached workspace data for extension and dashboard quick access
- **Relationships**: One per user; sync'd from candidate_profile and resumes collections

#### 3.2.7 `jobs`
- **Schema**: Not explicitly defined in models but referenced in jobDiscoveryService and matching engine
- **Key fields**: `_id`, `job_title`, `company_name`, `job_description`, `required_skills`, `preferred_skills`, `mandatory_skills`, `experience_min`, `experience_max`, `salary_min`, `salary_max`, `salary_currency`, `location`, `country`, `workplace_mode`, `employment_type`, `status`, `posted_at`, `created_at`, `canonical_url`, `application_url`
- **Purpose**: Discovered job postings from various sources

### 3.3 Relationships & Ownership
- **User-owned data**: All collections are scoped to `user_id` (or `_id` = `userId`)
- **Isolation**: Database queries are scoped to the authenticated user (no cross-user data access visible)
- **References**: 
  - `resumes.user_id` → `candidate_profiles._id`
  - `resume_claims.user_id` → `candidate_profiles._id`
  - `job_matches.user_id` → `candidate_profiles._id`
  - `candidate_onboarding.id` → `candidate_profiles._id`
  - `candidate_workspaces._id` → `candidate_profiles._id`

### 3.4 Indexes (implied by queries)
- Queries use `user_id` filtering as primary access pattern
- `candidate_profiles`: `_id: 1` (unique, since `_id` = `userId`)
- `resumes`: `{ user_id: 1, is_active: -1 }` (for active resume lookup)
- `job_matches`: `{ user_id: 1, job_id: 1 }` (for match lookup)
- `resume_claims`: `{ user_id: 1, verification_status: 1 }` (for claim listing)

### 3.5 Data Flow Examples

#### Profile Upload → Profile Storage
1. User uploads resume via `ResumeManagerPage`
2. `handleFileChange` → `analyzeResume` (resumeParser.ts) → extracts text, skills, detected fields
3. `handleConfirm` → `saveResume` (resumeService.upsert) → stores resume document in `resumes` collection
4. `syncToWorkspace` → pushes resume snapshot to `candidate_workspaces.data.resumes`
5. Profile fields auto-populated from detected resume data (name, email, phone, experience, skills)

#### Job Matching Flow
1. User discovers jobs → `listDiscoveredJobs` or `triggerJobDiscovery`
2. `recalculateMatches` (matchService) fetches:
   - Candidate profile (`candidateProfileService.get`)
   - Candidate preferences (`candidatePreferencesService.get`)
   - Truth claims (`truthEngineService.getClaims`)
3. Builds `CandidateMatchingProfile` with verified skills from truth engine
4. Fetches active jobs from `jobs` collection
5. `matchingEngine.evaluateMatch(candidateProfile, job)` computes 6 dimension scores
6. Hard eligibility check via `hardEligibilityEngine.evaluate`
7. Upserts match result to `job_matches` collection
8. UI displays matches with dimension scores, blockers, matched/missing skills

#### Targeted Resume Generation Flow
1. User selects job → `generateTargetedResume` (targetedResumeService)
2. Fetches base resume (master or specified) from `resumeStudioService`
3. Queries truth engine for verified facts: `truthEngineService.getVerifiedCandidateFacts`
4. Compares JD with resume via `resumeAnalyzerService.compareWithJobDescription`
5. Re-prioritizes skills: matched skills first, then remaining verified skills
6. Generates grounded professional summary from verified experience years and matched skills
7. Reorders experience bullets: matched-tech or metric bullets first, then others
8. Flags missing requirements (never fabricates)
9. Saves as new targeted resume draft in `resumeStudioService.createResume`
10. Returns grounding attestation: "All included skills, roles, and experience highlights were strictly derived from verified candidate profile records. No artificial or speculative qualifications were fabricated. Human review and approval is required before applying."

## 4. AI Integrations

### 4.1 Matching Engine (Deterministic Algorithm)
- **No LLM calls** for core matching (pure heuristic/rule-based)
- **6 dimension scores** with weighted calculation:
  - Skills alignment: 30% weight
  - Experience eligibility: 20% weight
  - Role relevance: 20% weight
  - Education eligibility: 10% weight
  - Location compatibility: 10% weight
  - Salary compatibility: 10% weight
- **Hard eligibility engine**: Checks mandatory skills, minimum experience, location compatibility
- **Confidence adjustment**: Starts at 100, deducted for missing inputs (-15 for no experience, -10 for no job experience min, -20 for no skills)
- **Minimum confidence floor**: 20%

### 4.2 Skill Taxonomy Normalization
- `skillTaxonomy.ts` provides `normalizeSkill()` function
- Maps variant skill names to canonical forms
- Enables consistent matching across different skill name formats

### 4.3 Resume Parser (Rule-Based, No LLM)
- **PDF**: `pdf-parse` library (extracts text from PDF)
- **DOCX**: `mammoth` library (extracts raw text from DOCX)
- **TXT**: Native `TextDecoder` with UTF-8 validation
- **Skill detection**: Uses `SKILL_CATALOG` list of ~50 common technical skills
- **Pattern matching**: Regex-based extraction of names, emails, phones, experience years
- **No AI/LLM involved** in parsing — pure text analysis

### 4.4 ATS Diagnostics (Heuristic Scoring)
- **5 categories** with 20 points each (total 100):
  1. Contact Information (email, phone, LinkedIn/GitHub, location): 20 pts
  2. Standard Section Headings (summary, experience, education, skills, projects/certifications): 20 pts
  3. Quantifiable Impact & Metrics (numbers with %, $, ₹, x, k, M): 20 pts
  4. Action-Oriented Phrasing & Power Verbs (list of 60+ action verbs): 20 pts
  5. Clean Formatting & Parseability (word count, bullet length): 20 pts
- **Rating thresholds**:
  - 85+: Exceptional
  - 70-84: Competitive
  - 50-69: Needs Optimization
  - Below 50: Critical Gaps
- **Disclaimer**: "This diagnostic score is an internal algorithmic heuristic based on industry ATS parsing benchmarks. No third-party ATS (such as Workday, Greenhouse, or Lever) exposes public scoring APIs; do not treat any score as an external platform guarantee."

### 4.5 JD Keyword Comparison (Rule-Based)
- `resumeAnalyzerService.compareWithJobDescription()`:
- Uses `KEYWORD_REGISTRY` of ~50 technical keywords
- For each keyword: checks if present in JD, counts frequency in JD, checks if present in resume or verified skill list
- Calculates `matchPercentage` = (matchedKeywords / totalRequiredKeywords) * 100
- Returns `matchedKeywords`, `missingKeywords`, `detailedKeywords` with foundInResume flags
- **Disclaimer**: No third-party ATS scoring guarantee

### 4.6 Truth Engine (Evidence-Based Claim Verification)
- **4 verification statuses**:
  - `verified_from_source`: Supporting source snippet provided (confidence: 0.95)
  - `candidate_confirmed`: Candidate confirmed the claim (confidence: 0.8)
  - `unverified`: No supporting evidence (confidence: 0.5 → 0.7 with evidence added)
  - `unsupported`: Candidate disputed/rejected → confidence: 0.0
- **Evidence sources**: uploaded_document, github_repo, credential_url, profile_entry, manual_claim
- **Claim categories**: skill, experience_years, employment_history, education, certification, project, measurable_achievement
- **Claim lifecycle**:
  1. Created from resume analysis (skills with line evidence, experience years)
  2. Verification status updated when evidence is added
  3. Candidate can confirm or dispute claims
  4. Unsupported claims are flagged and excluded from generated content
- **Verified facts extraction**: `getVerifiedCandidateFacts` filters out unverified/unsupported claims
- **Used by**: Targeted resume generation (grounded in verified facts), match intelligence (verified_skills), skill gap analysis

### 4.7 Targeted Resume Generation (Grounded AI)
- Uses verified facts from Truth Engine as source of truth
- Never fabricates skills, experience, or achievements
- Reorders and prioritizes existing candidate bullets
- Flags missing requirements as gaps (not fabricated qualifications)
- **Grounding attestation** included in every output:
  > "All included skills, roles, and experience highlights were strictly derived from verified candidate profile records. No artificial or speculative qualifications were fabricated. Human review and approval is required before applying."

### 4.8 Chrome Extension (MV3)
- **Manifest V3** configuration in `frontend\chrome-extension\manifest.json`
- **Content scripts**: Read job postings on supported portals (Greenhouse, Lever, Workday)
- **Side panel**: Pairing code entry, extension control
- **Popup**: Quick access to extension features
- **Background service worker**: Handles pairing, approval tracking
- **Zero-secret linking**: Pairing code flow, no API keys in extension
- **Human approval gate**: Explicit digital signature required before autofill or submission
- **Supported portals**: Greenhouse, Lever, Ashby, SmartRecruiters, Workday

### 4.9 External Service Integrations
- **MongoDB Atlas**: Cloud database hosting (referenced in UI)
- **Supabase**: Authentication (optional, cloud mode)
- **PDF parse**: pdf-parse library (local, no external API)
- **DOCX parse**: mammoth library (local, no external API)
- **No payment gateway code visible** in core flow (billing routes exist but implementation may be stubbed)
- **No real email service** visible (notification system appears local/cache-based)

## 5. External Services

### 5.1 Chrome Extension Ecosystem
- **MV3 Manifest**: Defines extension permissions, content scripts, side panel
- **Supported job portals**: Greenhouse, Lever, Ashby, SmartRecruiters, Workday
- **Extension communication**: 
  - Pairing code flow (6-digit, single-use, expires in 5 min)
  - Zero-secret: No credentials in extension
  - Content scripts read job pages only on explicit "Detect" click
  - Background worker handles approval tracking

### 5.2 Job Discovery Sources
- **Greenhouse adapter**: `backend\src\services\discovery\adapters\greenhouseAdapter.ts`
- **Lever adapter**: `backend\src\services\discovery\adapters\leverAdapter.ts`
- **Ashby adapter**: `backend\src\services\discovery\adapters\ashbyAdapter.ts`
- **SmartRecruiters adapter**: Likely exists
- **Workday adapter**: Likely exists
- **Manual/Extension**: Users can import jobs via URL or paste description
- **Discovery engine**: `backend\src\services\discovery\discoveryEngine.ts` orchestrates crawls
- **Job deduplication**: `backend\src\services\discovery\jobDeduplicationService.ts`

### 5.3 Notification System
- **Notification types** (from UI):
  - Job matches
  - Application updates
  - Interview reminders
  - Follow-up reminders
  - Resume alerts
  - Account/security alerts
- **Storage**: Database (`notifications` collection or similar, referenced in routes)
- **Delivery**: Not fully clear from source — may be polling-based or WebSocket
- **User preferences**: Configurable per type

### 5.4 Payment & Billing
- **Routes**: `billing.ts`, `adminBilling.ts`
- **Plans**: Free and PRO (badge in UI)
- **Payment gateway**: Not explicitly visible in source
- **Invoices**: Not explicitly visible
- **Feature restrictions**: BACKEND feature gating likely exists (not implemented in all frontend pages)
- **Subscription renewal**: Not clearly implemented

### 5.5 File Storage
- **Resumes**: Stored in MongoDB (file base64-encoded in API, not separate file storage)
- **Max size**: 5 MB per resume
- **Upload**: Base64 encoding via `toBase64()` helper function
- **No AWS S3** or external blob storage observed

### 5.6 Hosting & Deployment
- **Vercel**: `vercel.json` at root, `package.json` scripts suggest Vercel deployment
- **Node.js backend**: `server.ts` starts the Express server
- **Environment variables**: `.env.local`, `.env.example`, `.env.production`
- **Docker**: `Dockerfile` at root for containerized deployment

## 6. AI-Powered vs. Rule-Based Features

| Feature | AI/LLM | Rule-Based / Heuristic | Notes |
|---------|--------|------------------------|-------|
| Job matching | ❌ No | ✅ Deterministic algorithm | 6 dimensions, weighted score, hard eligibility |
| Resume parsing | ❌ No | ✅ Text extraction + regex + skill catalog | pdf-parse/mammoth/TextDecoder |
| ATS diagnostics | ❌ No | ✅ Heuristic scoring across 5 categories | Industry benchmark disclaimer |
| JD keyword comparison | ❌ No | ✅ Keyword registry + frequency counting | 50+ technical keywords |
| Targeted resume gen | ❌ No | ✅ Grounded in verified claims | Never fabricates, includes attestation |
| Skill gap analysis | ❌ No | ✅ Demand counting from job postings | Market demand analysis |
| Truth Engine | ❌ No | ✅ Evidence-based verification statuses | 4 statuses, confidence scores |
| Interview simulation | ⚠️ Partial | ✅ Progeni Atlas AI | "Powered by Progeni Atlas" but described as mock practice |
| Extension autofill | ❌ No | ✅ Profile-based field mapping | Human approval required |

**Conclusion**: The entire platform is **rule-based and heuristic**, not LLM/AI-generated. The "AI" branding comes from the deterministic matching engine, truth evidence layer, and targeted generation that is grounded in verified candidate data. There are no calls to external LLM providers (OpenAI, Anthropic, etc.) in the observed code.

## 7. Security Considerations

### 7.1 Data Protection
- **User-owned data**: All collections scoped to authenticated user_id
- **No cross-user data access**: Queries always include `user_id` filter
- **Consent gating**: Data processing and job application assistance consents required before feature activation
- **Extension pairing**: Zero-secret code flow, no credentials in extension

### 7.2 Potential Vulnerabilities
- **IDOR risk in matchService.get()**: Security check `findOne({ _id: id as any, user_id: userId })` present ✅
- **Resume file upload**: Base64 encoding in memory, 5 MB limit ✅
- **No password hashing visible**: Auth relies on Supabase or local storage
- **No rate limiting visible** beyond middleware mention
- **CORS**: Not configured visible in source

### 7.3 Data Leakage Risks
- **Resume text**: Sent to backend for parsing, stored in MongoDB `parsed_text` field
- **API tokens**: Not observed in source
- **Personal data**: Full name, email, phone, location stored in candidate_profiles
- **Extension pairing code**: 6-digit single-use, expires in 5 minutes, reasonable

### 7.4 Sensitive Information in Logs
- Not observable from source code
- Recommended: Mask PII in logs, avoid logging resume parsed text

## 8. Reliability & Scalability

### 8.1 Observed Issues
- **No background job framework**: All operations synchronous, may block on slow DB operations
- **No caching layer**: Data fetched fresh on each page load
- **No fallback if DB unavailable**: Try/catch but errors propagate to user
- **No test suite visible**: Test directory exists but may be empty or not executed

### 8.2 Scalability Concerns
- `job_matches` collection could grow large (one record per job per user)
- `jobs` collection queries without indexes could be slow
- No connection pooling or DB configuration visible

### 8.3 Performance
- Initial page loads fetch multiple collections via Promise.all (acceptable for small datasets)
- No pagination on some collections (e.g., `listCandidateMatches` limits to 25)
- Resume file size limited to 5 MB

## 9. Migration & Extension Points

### 9.1 Easy to Extend
- **New job sources**: Add adapter to `discovery\adapters\` following existing patterns
- **New skill catalog**: Extend `SKILL_CATALOG` in `resumeParser.ts`
- **New ATS categories**: Add categories in `resumeAnalyzerService.ts`
- **New match dimensions**: Modify `matchingEngine.ts` and `DEFAULT_DIMENSION_WEIGHTS`
- **New claim categories**: Extend `ClaimCategory` in `truthEngineService.ts`

### 9.2 Moderate Effort
- **Backend API additions**: Follow existing route/controller pattern
- **Frontend page additions**: Follow existing component patterns
- **Extension portal support**: Add adapter to discovery registry

### 9.3 Difficult/Unclear
- **Payment integration**: No Stripe/SQL database observed
- **Real-time notifications**: Unclear if WebSocket or polling
- **LLM integration**: No current infrastructure; would require significant new backend