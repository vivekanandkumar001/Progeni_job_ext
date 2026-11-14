# Progeni AutoApply — Executive Summary

## What is Progeni AutoApply?

Progeni AutoApply is a candidate suite that automates and intelligentizes the job search, resume management, and application process. It combines AI-powered job matching, resume intelligence, skill gap analysis, and application automation into a unified platform designed to help job candidates find suitable roles and apply more effectively.

**Core Philosophy**: Every score, match, and generated claim is grounded in verified candidate data. The platform never fabricates qualifications or submits applications without explicit human approval.

## Problem It Solves for Job Candidates

1. **Information Overload**: Helps candidates cut through thousands of job postings by matching roles to their verified skills and experience.

2. **Resume Tailoring**: Enables quick creation of job-specific resumes that highlight relevant experience and skills while maintaining truthfulness.

3. **Application Friction**: Reduces manual data entry through browser extension autofill and profile auto-population.

4. **Interview Preparation**: Provides practice simulations and feedback based on the candidate's actual profile.

5. **Organization**: Centralizes job tracking, follow-up management, and interview scheduling in one workspace.

## 5 Most Valuable Features

| Rank | Feature | Why It Matters |
|------|---------|----------------|
| 1 | **Truth Engine (Evidence Mapping)** | Ensures all resume claims are verifiable, preventing hallucinations and maintaining candidate integrity |
| 2 | **Deterministic Match Algorithm** | Transparent, explainable matching scores across 6 dimensions (skills, experience, role, education, location, salary) |
| 3 | **Targeted Resume Generator** | Creates job-specific resume content grounded in the candidate's actual verified profile |
| 4 | **Application Assistant (Chrome Extension)** | Automates form field pre-filling while requiring explicit human approval before submission |
| 5 | **Application Lifecycle Tracker** | Full lifecycle tracking from discovery through offer/ rejection with follow-up management |

## Product Architecture Differences From Ordinary Job Portals

| Aspect | Ordinary Job Portal | Progeni AutoApply |
|--------|--------------------|-------------------|
| **Data Source** | Job aggregator only | Candidate profile + verified resume evidence + job market data |
| **Matching** | Simple keyword or rule-based | Multi-dimensional deterministic algorithm with 6 weighted factors |
| **Resume Handling** | Upload → Store → Manual edit | Parse → Verify → Targeted generation → ATS diagnostics → Evidence-backed editing |
| **AI Accountability** | Often absent or opaque | Truth Engine with 4 verification statuses and explicit anti-fabrication policy |
| **Application Automation** | Often auto-apply (risky) | Human-in-the-loop with explicit approval gate at every submission step |
| **Transparency** | Match scores without explanation | Explainable breakdown across 6 dimensions with matched/missing skills listed |

## Complete Candidate Lifecycle

```
Registration → Onboarding (5 stages) → Career Profile → Resume Upload → Parsing → 
Dashboard → Jobs & Discovery → Match Intelligence → Skill Gap Analysis → 
Targeted Resume Generation → ATS Diagnostics → Resume Studio → Application Assistant → 
Approval Gate → Application Tracker → Interview Center → Follow-Up Manager → Analytics
```

## Key Technical Stack

- **Frontend**: Next.js 13+ (App Router), React, TypeScript, Tailwind CSS, Lucide Icons
- **Backend**: Node.js/TypeScript, Express, MongoDB with Mongoose
- **Database**: MongoDB Collections (candidate_profiles, candidate_onboarding, resumes, job_matches, resume_claims, candidate_workspaces, jobs)
- **AI/Matching**: Custom deterministic matching engine with 6 dimension scores, skill taxonomy normalization
- **Resume Parsing**: pdf-parse (PDF), mammoth (DOCX), native TextDecoder (TXT)
- **ATS Analysis**: Heuristic-based scoring across 5 categories (contact info, headings, metrics, phrasing, formatting)
- **Extension**: MV3 Chrome extension with zero-secret pairing code flow
- **Consent**: Explicit data processing and job application assistance consents required before feature activation

## Implementation Status Overview

Based on code review, the implementation status ranges from:

- ✅ **Fully Implemented**: Onboarding wizard, career profile management, resume upload/parsing, match intelligence, skill gap analyzer, ATS diagnostics, targeted resume generator, truth engine, application tracker, interview center, follow-up manager, notifications, privacy settings
- 🟡 **Partially Implemented**: Application Assistant (Chrome extension MV3 framework exists but requires pair code setup), Analytics (basic metrics displayed, some calculation formulas present)
- ⚪ **UI Only**: Some feature pages exist with interactive elements but may lack full backend integration in certain deployments