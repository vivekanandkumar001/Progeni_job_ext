# 02. Comprehensive Architecture Map & Data Flow Topology

> **Document ID:** `AUDIT-02-ARCH-MAP`  
> **Target System:** Auto Apply AI Platform  
> **Auditor:** Forensic Engineering & Architecture Review Team  
> **Audit Status:** Verified against Source Code & AST Analysis  
> **Date:** November 2026

---

## 1. System Context & Architectural Overview

The Auto Apply AI platform is designed as a hybrid career automation ecosystem combining an **Express.js / MongoDB** REST API backend, **two Next.js 15 App Router web clients** (Candidate Web Dashboard and Admin Panel), and a **Manifest V3 Chrome Extension**.

Contrary to marketing claims of an autonomous scraping bot, the architecture enforces a **Human-in-the-Loop (HITL) Controlled Automation** paradigm. The extension inspects applicant tracking system (ATS) web forms in candidate browser sessions, matches them against grounded candidate profile data, populates form fields via custom DOM events, and pauses for manual user verification and submission.

```mermaid
flowchart TB
    subgraph ClientLayer ["Client Presentation Layer"]
        CWD["Candidate Web Dashboard<br/>(Next.js 15 App Router / Tailwind)"]
        ADM["Admin Console<br/>(Next.js 15 App Router / Tailwind)"]
        EXT["Chrome Extension (MV3)<br/>Popup / Side Panel / Content Scripts"]
    end

    subgraph SecurityPerimeter ["Network & Security Boundary"]
        CORS["CORS Policy & Origin Validation"]
        RATELIMIT["Express Rate Limiting (100 req / 15 min)"]
        JWT["JWT Authentication Guard & Role Verifier"]
        ZOD["Zod Schema Validation Guard"]
    end

    subgraph BackendCore ["Backend Application Server (Express / TypeScript)"]
        AUTH_SVC["Auth Service<br/>(bcryptjs / jsonwebtoken)"]
        PROF_SVC["Profile & Workspace Service<br/>(Candidate Workspace / Revision Lock)"]
        RES_SVC["Resume Parsing & Analysis Engine<br/>(PDF-Parse / Token Matcher)"]
        MATCH_SVC["Deterministic Job Matcher<br/>(Hard Filter & Scoring Engine)"]
        ANS_SVC["Explainable Answer Engine<br/>(Zero-Hallucination Fact Grounder)"]
        APP_SVC["Application Tracker & History<br/>(Lifecycle & Audit Log)"]
    end

    subgraph DataStorage ["Data Persistence Layer (MongoDB / Mongoose)"]
        DB_WORKSPACE[("candidate_workspaces<br/>(Atomic Unified Document)")]
        DB_USERS[("users<br/>(Credentials & Role)")]
        DB_RESUMES[("resumes<br/>(Parsed Resume Vault)")]
        DB_JOBS[("jobs<br/>(Indexed Opportunity Catalog)")]
        DB_MATCHES[("job_matches<br/>(Compatibility Scores)")]
        DB_APPS[("applications<br/>(Application Tracking Records)")]
    end

    subgraph ExternalWeb ["Candidate Browser Session & Target ATS Systems"]
        BROWSER_DOM["Browser Tab Active DOM"]
        ATS_GH["Greenhouse (`boards.greenhouse.io`)"]
        ATS_LEV["Lever (`jobs.lever.co`)"]
        ATS_ASH["Ashby (`jobs.ashbyhq.com`)"]
        ATS_WD["Workday (`myworkdayjobs.com`)"]
        ATS_SR["SmartRecruiters (`smartrecruiters.com`)"]
        ATS_EXT["Job Boards (LinkedIn / Indeed / Naukri)"]
    end

    CWD --> CORS
    ADM --> CORS
    EXT --> CORS
    CORS --> RATELIMIT
    RATELIMIT --> JWT
    JWT --> ZOD

    ZOD --> AUTH_SVC
    ZOD --> PROF_SVC
    ZOD --> RES_SVC
    ZOD --> MATCH_SVC
    ZOD --> ANS_SVC
    ZOD --> APP_SVC

    AUTH_SVC --> DB_USERS
    PROF_SVC --> DB_WORKSPACE
    RES_SVC --> DB_RESUMES
    RES_SVC --> DB_WORKSPACE
    MATCH_SVC --> DB_JOBS
    MATCH_SVC --> DB_MATCHES
    ANS_SVC --> DB_WORKSPACE
    APP_SVC --> DB_APPS
    APP_SVC --> DB_WORKSPACE

    EXT -.->|Injected Content Scripts| BROWSER_DOM
    BROWSER_DOM --- ATS_GH
    BROWSER_DOM --- ATS_LEV
    BROWSER_DOM --- ATS_ASH
    BROWSER_DOM --- ATS_WD
    BROWSER_DOM --- ATS_SR
    BROWSER_DOM --- ATS_EXT
```

---

## 2. Component Communication & Service Boundaries

### 2.1 Component Interaction Matrix

| Initiating Component | Target Component | Transport Protocol | Authentication / Security | Data Format |
|---|---|---|---|---|
| **Chrome Extension (Popup/Panel)** | Extension Service Worker | `chrome.runtime.sendMessage` | Internal MV3 Message Channel | JSON Messages (`{ type, payload }`) |
| **Extension Service Worker** | Tab Content Scripts | `chrome.tabs.sendMessage` | Tab ID & Active Window Isolation | JSON Commands (`ANALYZE_FORM`, `FILL_FIELDS`) |
| **Extension Service Worker** | Backend REST API | HTTPS / Fetch | Bearer JWT (Stored in `chrome.storage.local`) | JSON Payloads (`/api/v1/*`) |
| **Candidate Web Dashboard** | Backend REST API | HTTPS / Fetch (Client & SSR) | Bearer JWT (`auth_token` Cookie / LocalStorage) | JSON Payloads |
| **Admin Panel** | Backend REST API | HTTPS / Fetch | Bearer JWT (`admin` Role Check in middleware) | JSON Payloads |
| **Content Script** | Active Web Page DOM | Direct DOM API | Isolated Content Script World | Native Element Dispatch Events |
| **Backend REST API** | MongoDB Instance | Mongoose v8 Driver | SCRAM-SHA-256 Auth / Connection Pool | BSON |

---

## 3. End-to-End Data Flow Topologies

### 3.1 Resume Ingestion, Grounding, and Workspace Synchronization

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate User
    participant WebUI as Candidate Web Dashboard
    participant API as Backend Express Server
    participant ResumeEng as Resume Ingestion Service
    participant Mongo as MongoDB Persistent Storage

    Candidate->>WebUI: Uploads Resume (PDF / DOCX)
    WebUI->>API: POST /api/v1/resumes/upload (multipart/form-data)
    Note over API: Rate Limiter & JWT Guard verify request
    API->>ResumeEng: parseResumeBuffer(buffer, mimeType)
    ResumeEng->>ResumeEng: Extract Text (pdf-parse / text extraction)
    ResumeEng->>ResumeEng: Deterministic Regex & Section Tokenizer
    ResumeEng-->>API: Structured Profile (Skills, Experience, Education, Contact)
    API->>Mongo: Insert into `resumes` collection
    API->>Mongo: Upsert `candidate_workspaces` (Sync Master Profile)
    Mongo-->>API: Acknowledged (Revision ID incremented)
    API-->>WebUI: 201 Created (Extracted Profile & ATS Keyword Density)
    WebUI-->>Candidate: Displays Parsed Profile for Verification & Edit
```

---

### 3.2 Job Extraction, Matching, and Scoring Flow

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate / Job Seeker
    participant Extension as Extension Content Script
    participant ATS as Job Listing Page (ATS / Board)
    participant Worker as Extension Service Worker
    participant API as Backend Matching Engine
    participant DB as MongoDB

    Candidate->>ATS: Navigates to Job Posting
    Extension->>ATS: Inspect DOM using Registered Adapters
    ATS-->>Extension: Extracted Metadata (Title, Company, Description, Location, Salary)
    Extension->>Worker: `JOB_EXTRACTED` event
    Worker->>API: POST /api/v1/jobs (Ingest / Upsert Job)
    API->>DB: Upsert Job Record in `jobs`
    Worker->>API: POST /api/v1/matches/evaluate (Job ID + Workspace ID)
    API->>API: Execute Deterministic Match Matrix:
    Note over API: 1. Hard Eligibility Filters (Visa, Location, Minimum YOE)<br/>2. Weighted Skill Overlap (Required vs Candidate Skills)<br/>3. Experience & Education Title Normalization
    API->>DB: Persist Score & Missing Skills in `job_matches`
    API-->>Worker: Return Match Score (0-100), Breakdown, and Missing Skills
    Worker->>Extension: Display Match Pill / Badge in DOM Overlay
    Extension-->>Candidate: Visual Match Score & Eligibility Status
```

---

### 3.3 Controlled Form Autofill and User Approval Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate User
    participant DOM as ATS Page DOM (Target Form)
    participant CS as Extension Content Script
    participant Registry as ATS Adapter Registry
    participant SW as Background Service Worker
    participant Engine as Backend Answer Engine

    Candidate->>CS: Clicks "Analyze & Autofill" in Extension
    CS->>Registry: `detectPlatform(window.location.href)`
    Registry-->>CS: Active Adapter (e.g., `GreenhouseAdapter`)
    CS->>Registry: `adapter.extractFields()`
    Registry-->>CS: Normalized Form Fields Map

    loop For Each Screening Question / Dynamic Field
        CS->>SW: Request Field Value (Key, Label, Type, Options)
        SW->>Engine: POST /api/v1/answer-engine/answer
        Engine->>Engine: Query Candidate Workspace Facts
        alt Verified Exact Grounded Fact Exists
            Engine-->>SW: Grounded Answer (Confidence: 1.0, Source: "profile")
        else Screening Question Matched
            Engine-->>SW: Answer from `verifiedAnswers` (Confidence: 0.95)
        else Sensitive / Unknown Fact (Salary / Visa / Clearance)
            Engine-->>SW: Refusal Flag (`requires_human_input: true`)
        end
        SW-->>CS: Form Field Value & Grounding Confidence
    end

    CS->>DOM: Execute Synthetic Events (`input`, `change`, `blur`)
    Note over DOM: React/Vue synthetic event triggers simulate real typing
    CS-->>Candidate: Highlights Filled Fields in Green & Unknowns in Amber
    Note over Candidate: User inspects values, fills manual fields, and clicks SUBMIT
    Candidate->>DOM: User manually clicks "Submit Application"
    CS->>SW: `APPLICATION_SUBMITTED` (Capture Confirmation DOM state)
    SW->>Engine: POST /api/v1/applications (Record Applied Status)
```

---

## 4. Architectural Boundaries and Isolation Guarantees

### 4.1 Chrome Manifest V3 Security Boundary
1. **Isolated Content Script Execution:** Extension content scripts operate within Chrome's isolated world execution environment. They do not access the web page's JavaScript global variable scope directly, preventing malicious career sites from reading sensitive JWT tokens or profile state.
2. **Credential Storage:** User authentication tokens are stored exclusively in `chrome.storage.local`. Content scripts never store or cache JWT credentials; all backend-bound operations are routed through the Background Service Worker.
3. **No Dynamic Code Evaluation:** Code is bundled strictly using Vite with `eval` and `new Function` disabled, ensuring full compliance with Chrome Web Store Manifest V3 security requirements.

### 4.2 Data Persistence Architecture
The database layer features an intentional coexistence of two data models:
1. **`candidate_workspaces` (Atomic Root Document):** Implements an optimistic concurrency control mechanism via `revision: Number`. Provides unified access to candidate identity, skills, experiences, and verified profile Q&A in a single sub-document tree.
2. **Normalized Collections (`users`, `resumes`, `jobs`, `job_matches`, `applications`):** Supports relational queries, aggregation pipelines, job catalog searches, and administrative reporting.
3. **Cascade Integrity:** Account deletion (`DELETE /api/v1/candidate-profile`) executes a transactional cascade wipe across all six collections.

---

## 5. Architectural Defects and Technical Debt

1. **Dual State Drift Risk:** `candidate_workspaces` and `candidate_profiles` duplicate personal identity fields. Synchronization is currently maintained via controller logic rather than MongoDB multi-document ACID transactions.
2. **Memory Cache Absence:** Rate limiting uses in-memory counters (`express-rate-limit`), which will not scale across clustered containers or serverless instances without an external Redis store.
3. **Frontend-Backend Decoupling:** The Candidate Dashboard has 14 routes stubbed out with static mock state (`[DEMO DATA]`), leaving the backend APIs functionally ahead of the primary web interface.
4. **Adapter Execution Constraints:** Form filling relies entirely on client-side DOM parsing; changes to third-party ATS DOM hierarchies requires extension client updates unless a remote selector registry is introduced.

