# Progeni AutoApply — End-to-End User Journeys

## Journey A: New Candidate — From Registration to Dashboard

### Entry Point
- User navigates to Progeni AutoApply web dashboard
- Authentication required (Supabase or local mode)

### Steps

1. **Consent Gateway**
   - User must accept "Privacy & Security Guardrails" before accessing any features
   - Includes zero-hallucination guarantee, human-in-the-loop, data sovereignty statements
   - Must explicitly agree before proceeding

2. **Onboarding Wizard (5 stages)**
   - **Stage 1: Personal Identity**
     - Full legal name, verified email, phone number, primary target role
     - Current city/country, years of experience, core technical skills
     - LinkedIn URL, GitHub URL, portfolio URL
     - ✅ Saves to `candidate_profiles` and advances to Stage 2

   - **Stage 2: Career Preferences**
     - Desired job roles (comma-separated), preferred locations
     - Workplace mode (remote/hybrid/office/any)
     - Experience level (entry/mid/senior/lead/executive)
     - Joining availability (immediate/15/30/60/90 days)
     - Employment type (full-time/contract/part-time/internship)
     - Salary currency and min/max expectations
     - ✅ Mirrors primary target_role into profile if set, advances to Stage 3

   - **Stage 3: Resume Intelligence**
     - Upload resume (PDF/DOCX/TXT, max 5 MB)
     - Backend parser extracts: detected fullName/email/phone/experienceYears, verified skills with evidence lines, warnings
     - ✅ Pre-populates missing profile fields with detected resume facts
     - ✅ Updates profile on backend with extracted skills
     - Advances to Stage 4

   - **Stage 4: Extension & Consent**
     - Generate 6-digit pairing code (expires in 5 minutes)
     - Enter code in Chrome Extension Side Panel → "Pair with Code" → "Link Extension"
     - Data Processing Consent checkbox (required)
     - Job Application Assistance Consent checkbox (required — enables extension autofill)
     - ✅ Verifies extension connection status
     - Advances to Stage 5

   - **Stage 5: Review & Launch**
     - Profile completeness gauge with completed/optional criteria
     - Identity summary (name, email, role, location)
     - Preferences summary (desired roles, locations, workplace, availability)
     - Resume summary (primary file name, experience years)
     - ✅ "Onboarding successfully completed! Redirecting to your dashboard…"
     - ✅ `router.push('/dashboard')` after 1-second timeout

3. **Dashboard Access**
   - On completion, user lands on dashboard
   - Shows: tracked opportunities count, jobs analyzed count, profile completeness %, extension connection status, active resume count
   - Quick actions: Onboarding wizard (if incomplete), Edit career profile, Check job match

### Outcome
- Candidate has complete profile, onboarding finished, dashboard accessible
- All data persisted in MongoDB: `candidate_profiles`, `candidate_onboarding`, `resumes`, `candidate_workspaces`

---

## Journey B: Find the Right Job

### Entry Point
- From dashboard, user navigates to **Jobs & Discovery** or **Job Recommendations**

### Steps

1. **Job Discovery**
   - User clicks "↻ Crawl Live Sources" → triggers discovery crawl across Greenhouse, Lever, Ashby, SmartRecruiters & Workday
   - Status displayed: "Discovery finished: Found X postings, inserted Y, updated Z"
   - Jobs loaded with provider badges, personalized match scores (if profile complete)

2. **Filter & Search**
   - Keywords search bar (e.g., "Python Developer, React, Stripe")
   - Workplace mode filter (remote/hybrid/office/any)
   - ATS provider filter (greenhouse/lever/ashby/smartrecruiters/workday/manual)
   - Location input (e.g., "San Francisco, US")
   - Real-time filtering with pagination (15 jobs per page)

3. **Personalized Recommendations**
   - Switch to "✦ Recommended For You" tab
   - Shows jobs with personalized match percentages (e.g., "78% Match")
   - Match reasons chips: ✓ matched skills displayed

4. **Explore All Postings**
   - Switch to "🔍 Explore All Postings" tab
   - All active jobs from all providers, searchable/filterable

5. **Save Jobs**
   - Click ★ bookmark on any job card
   - Toggles to ★ (unsave on click)
   - Saved jobs accessible via "★ Saved Jobs" tab

6. **View Job Details**
   - Click "View Details" on any job card
   - Modal opens with: provider, title, company, workplace mode, location, experience, salary, required/preferred skills, job description
   - "Apply on Original Board" link opens original application URL
   - "Bookmark Job" toggle

7. **Manual Job Import**
   - Click "+ Import Job Posting" button
   - Modal with: job title (required), company name, application URL, workplace mode, location, salary range (optional), job description text
   - "Normalize & Save Job" → creates job in system

### Outcome
- Candidate has discovered relevant jobs, can save favorites, and view detailed information
- Jobs stored in `jobs` collection with provider, status, and match metadata

---

## Journey C: Generate a Job-Specific Resume

### Entry Point
- From dashboard or job recommendations, user selects a job and clicks "Generate Targeted Resume"

### Steps

1. **Select Base Resume**
   - Option A: Use master career profile resume (automatically from Resume Studio)
   - Option B: Use a specific previously saved resume variant

2. **Provide Job Description**
   - Paste job description text (minimum 20 characters)
   - Or select from saved job with its description already attached

3. **Truth Engine Verification**
   - Backend queries Truth Engine for verified candidate facts
   - Extracts: verified skills set, experience years (if available)
   - ⚠️ **Zero-Hallucination Guarantee**: Only verified facts used, no fabrication

4. **JD vs Resume Comparison**
   - `resumeAnalyzerService.compareWithJobDescription()` runs:
     - 50+ technical keyword analysis
     - Match percentage calculation
     - Matched keywords list
     - Missing keywords list
     - Detailed per-keyword foundInResume flags

5. **Targeted Resume Generation**
   - **Professional Summary**: Grounded in verified experience years + top 4 matched skills
     - Example: "Results-driven Software Engineer with 5+ years of demonstrated experience in Python, React, SQL, and TypeScript. Proven track record of designing high-performance architectures, optimizing data workflows, and executing robust software engineering best practices."
   - **Skills Reordering**: Matched verified skills appear first, followed by other verified skills
   - **Experience Highlights**: Bullets mentioning matched tech or metrics reordered to appear first; other genuine bullets follow
   - **Missing Requirements**: Flagged as gaps (never fabricated into resume)
   - **Alignment Score**: % match displayed (e.g., "85% Job Alignment")

6. **Save as Draft**
   - New targeted resume saved to Resume Studio as non-master draft variant
   - Title: "Targeted: [Role] - [Company]"
   - Available in Resume Studio editor for further tweaking

7. **Export**
   - PDF or DOCX export from Resume Studio
   - All content grounded in verified candidate data

### Outcome
- Candidate has a job-tailored resume that strictly derives from their verified profile
- Missing requirements are honest gaps, not fabricated qualifications
- Grounding attestation included for integrity

---

## Journey D: Apply for Jobs

### Entry Point
- From job recommendations or match intelligence, user selects a job and proceeds to application

### Steps

1. **Select Job in Application Assistant**
   - User chooses job from opportunity selector
   - Displays: job title, company, location, readiness score (0-100%), status

2. **Application Readiness Assessment**
   - Technical readiness gauge shows score/100 across 6 dimensions:
     - Resume (max 20 pts)
     - Cover Letter (max 15 pts)
     - Screening Q&A (max 25 pts)
     - Form Mappings (max 20 pts)
     - Integrity (max 10 pts)
     - Human Approval (max 10 pts)
   - "READY FOR SUBMISSION" or "PREPARATION IN PROGRESS" badge

3. **Missing Information Warnings**
   - If any readiness dimension is incomplete, warnings displayed
   - Examples: "Resume not tailored", "Cover letter not generated", "Screening answers pending", "Form fields unapproved", "Missing profile information", "Explicit human approval required"

4. **Resume Tailoring (if needed)**
   - Click "Regenerate Tailored Resume" → generates grounded tailored summary + prioritized skills
   - Can copy tailored summary to clipboard

5. **Cover Letter Generation (if needed)**
   - Select tone preset (professional/concise/technical/enthusiastic)
   - Or provide custom focus instructions
   - Click "Regenerate" → generates cover letter grounded in verified achievements
   - Can copy to clipboard or save changes

6. **Screening Questions & Answers**
   - Review existing answers (grounded in verified profile)
   - Legal/financial questions require candidate attestation (checkbox + answer)
   - Add custom questions from job board
   - Save & Confirm Answers → updates readiness score

7. **Form Field Mappings (Chrome Extension Assisted)**
   - Review/configure field mappings for autofill:
     - Personal info (name, email, phone)
     - Education (degree, institution)
     - Experience (company, role, dates)
     - Skills (technical skills)
   - Approve each field value individually (checkbox)
   - Save form mappings

8. **Human Approval Gate (CRITICAL)**
   - **Cannot proceed without explicit approval**
   - Digital confirmation signature: "Type your full legal name to sign approval"
   - Audit hash permanently recorded in application history
   - Must review tailored assets and provide explicit confirmation prior to submission

9. **Explicit Approval**
   - User types full legal name into signature input
   - Clicks "I Authorize & Approve"
   - Digital audit signature recorded
   - Application status updates to approved/prepared

10. **Application Submission**
    - **Option A: Manual Submission**
      - User clicks "Confirm Submission" in Application Tracker
      - Provides: destination URL (application portal), submission method (portal/direct_api/extension_assisted/manual)
      - Confirmation reference code (if available)
      - Notes (optional)
      - Confirmation text/snippet (optional)
      - Records submission evidence in tracker

    - **Option B: Extension-Assisted Autofill**
      - Chrome Extension reads form fields
      - Pre-fills based on approved form field mappings
      - **STOPS before submit** — user must review all form fields
      - User clicks final submit on employer's site

    - **Option C: Direct ATS API**
      - Backend API submits application (if employer's ATS supports it)
      - Requires confirmation reference from employer

11. **Application Tracker Update**
    - Application status updated (discovered → preparing → submitted → under review → etc.)
    - Submission evidence recorded (confirmation reference, verification status)
    - Follow-up tasks may be auto-generated
    - Interview count tracking begins

### Outcome
- Application either manually confirmed, extension-assisted (with review), or submitted via ATS API
- All actions audited and tracked
- Follow-up tasks may be scheduled

---

## Journey E: Get Interview-Ready

### Entry Point
- From Application Tracker, application status is "interview_scheduled" or user navigates to Interview Center

### Steps

1. **Interview Pipeline View**
   - See upcoming rounds (HR screening, Technical, Coding Assessment, Managerial, Final Round)
   - See completed rounds with feedback
   - Switch between Agenda View and Pipeline Kanban View

2. **Schedule Interview**
   - Interview created in system with:
     - Stage (HR screening/Technical/Coding/Managerial/Final)
     - Company and job title
     - Scheduled date/time and timezone
     - Duration in minutes
     - Interviewer details (name, title)
     - Meeting link (video conference)
   - ✅ Backend: `listInterviews`, interview record stored in `interviews` collection

3. **Progeni Atlas AI Practice Simulation**
   - Click "⚡ Practice with Progeni Atlas AI"
   - Launch simulation modal
   - Enter target job role (e.g., "Senior Backend Engineer (Node.js & Go)")
   - Optionally paste job description topics/focus areas
   - Click "🚀 Launch Live Room"
   - Opens Progeni Atlas simulation session (new tab)
   - Session ID recorded, results savable

4. **Simulation Feedback**
   - After simulation, record feedback:
     - Overall signal rating (1-5 stars)
     - Key strengths observed (one per line)
     - Areas to polish/review (one per line)
     - Questions asked by interviewer (one per line)
     - Overall impression & takeaways
   - Feedback stored in `interviews` collection
   - Updates interview record with rating/strengths/areas

5. **Review Past Interviews**
   - Completed rounds list with:
     - Rating stars (★★★★☆ format)
     - Overall impression quote
     - Edit feedback capability
   - Learn from previous interview performance

### Outcome
- Candidate has practiced with AI simulation, recorded interview feedback, and has interview history for learning

---

## Journey F: Recruiter Follow-Up

### Entry Point
- From Application Tracker, application has pending follow-ups or user navigates to Follow-Up Manager

### Steps

1. **View Pending Follow-Ups**
   - Filter by: Pending Tasks, Overdue Only, Completed, All
   - Each task shows: next action, company, job title, due date, status (overdue badge if applicable)
   - History count: number of previous events

2. **Log Follow-Up Action**
   - Click "Log Action / Complete" on any task
   - Action description select:
     - Sent email status inquiry
     - Reached out on LinkedIn
     - Followed up with hiring manager
     - Received recruiter reply
     - Submitted requested supplementary materials
     - Other follow-up action
   - Details & notes textarea (free text)
   - Option: Mark this follow-up task as Completed
   - Option: Schedule next follow-up (YYYY-MM-DD date picker)

3. **Action Logging**
   - Action recorded in `followUps` collection
   - Notice: "Follow-up action logged for [company]."
   - Modal closes, task list updates

4. **Follow-Up History**
   - Each task maintains history array of events
   - "History: X event(s)" displayed per task
   - Helps track recruiter response patterns

5. **Follow-Up Detection (limitations)**
   - ⚠️ **Not implemented**: System does not automatically detect recruiter replies
   - ⚠️ **Not implemented**: System does not send actual emails
   - User must manually log "Received recruiter reply" action

### Outcome
- Candidate can track and log recruiter touchpoints, but cannot send automated emails or auto-detect replies

---

## Journey G: Measure Performance

### Entry Point
- From Application Tracker or dashboard, user navigates to Analytics & Rates

### Steps

1. **Top Key Metrics Row**
   - Total Applications count with breakdown (pending/verified/candidate-reported)
   - Employer Response Rate (e.g., "42%") with response count
   - Interview Conversion Rate (e.g., "15%") with interviews scheduled count
   - Offer Conversion Rate (e.g., "8%") with offers received/accepted count

2. **Submission Verification Audit Breakdown**
   - Verified Submissions count (confirmed with external reference number)
   - Candidate-Reported Submissions count ( candidate confirmed manual completion)
   - Unsubmitted / In Progress count (discovered, preparing, awaiting approval)

3. **Stage Funnel Distribution**
   - Visual breakdown of applications across all lifecycle stages:
     - Discovered, Preparing, Submitted, Under Review, Interviews, Offers, Archived/Closed
   - Count per stage displayed in grid

4. **Transparent Denominator Documentation**
   - Mathematical formulae displayed with denominator values:
     - Response Rate denominator
     - Interview Conversion Rate denominator
     - Offer Conversion Rate denominator
   - Explains what's included/excluded from each rate calculation

5. **Performance Insights**
   - Identify weak areas in the application pipeline
   - Compare conversion rates across time periods (if available)
   - Correlate with resume diagnostics or skill gap analysis

### Outcome
- Candidate can measure their job search performance, identify improvement areas, and track progress over time.