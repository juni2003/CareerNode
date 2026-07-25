CareerNode — Complete Project Documentation
Repository: juni2003/CareerNode
Purpose: AI-powered personal job application tracking system integrated with Gmail and Gemini AI.

Table of Contents
Project Overview
Why This Project Was Built
Core Advantages and Impact
Who Should Use CareerNode
System Architecture
Repository Structure and Responsibility
Technology Stack (and Why It Matters)
How CareerNode Works (End-to-End Flow)
Detailed Setup Guide (Local Machine)
Gmail Setup (Very Detailed)
Environment Variables Explained
Running the Project
Windows One-Click Startup Script (start.bat)
Data and Security Considerations
Deployment Guide (Private Self-Hosted)
Troubleshooting Guide
Future Improvements / Roadmap Suggestions
Conclusion
1) Project Overview
CareerNode is a single-user, AI-assisted career pipeline system built to help engineers and job seekers automatically track job applications and progress stages using data extracted from Gmail messages.

It combines:

Email ingestion (IMAP/Gmail)
AI extraction (Gemini)
Structured storage (MongoDB)
Visual tracking dashboard (Next.js frontend)
Embedded AI assistant for career support (cover letters, interview prep, summaries)
The main problem it solves:
Most job seekers manually track status updates in spreadsheets or notes, while critical updates are scattered across recruiter emails. CareerNode automates this tracking pipeline.

2) Why This Project Was Built
CareerNode exists because job searching at scale has 4 persistent pain points:

Fragmented communication
Application updates arrive through many email formats and subjects, often with inconsistent status language.

Manual data entry fatigue
Users manually update “Applied / Interview / Offer / Rejected” records repeatedly, causing stale or inaccurate tracking.

Lack of actionable insights
Traditional trackers rarely provide useful analytics (conversion rates, bottlenecks, stage progression).

No integrated AI context
Existing tools may track status, but do not use personal resume/projects context for AI-driven suggestions.

CareerNode addresses all four by turning email noise into a structured, continuously updated application pipeline.

3) Core Advantages and Impact
3.1 Automated Pipeline Maintenance
By connecting to Gmail and scanning application-related messages, the app reduces repetitive tracking work.

3.2 Better Accuracy than Manual Spreadsheets
AI parsing extracts role, company, and status from real recruiter language, improving consistency.

3.3 Career Decision Visibility
Dashboard stage tracking helps users understand:

where applications are stalling,
their interview conversion trend,
where to optimize effort.
3.4 Embedded Career AI Assistant
Because assistant features are integrated with application context (and resume/portfolio context), responses are more personalized than generic chat tools.

3.5 Self-Hosted Personal Ownership
Users control their own instance, credentials, and database — no dependency on a centralized third-party platform.

4) Who Should Use CareerNode
CareerNode is ideal for:

Engineers applying to multiple roles weekly
Students/new graduates tracking internships/full-time applications
Professionals wanting AI-driven support with interview prep and written communication
5) System Architecture
CareerNode follows a decoupled frontend-backend architecture:

Frontend: Next.js application serving dashboard and assistant UI.
Backend: FastAPI app exposing APIs for job records, analytics, email sweep, and AI features.
Database: MongoDB for storing applications and related entities.
AI Layer: Gemini API for parsing recruiter emails and powering assistant actions.
Email Layer: Gmail IMAP access via app password for secure mailbox reading.
High-level flow
Backend connects to Gmail via IMAP.
Relevant emails are fetched and parsed.
Gemini extracts structured fields:
company
role
status/stage
Backend writes/updates MongoDB records.
Frontend reads APIs and renders dashboard insights.
User can chat with AI assistant using project context.
6) Repository Structure and Responsibility
Based on attached information:

CareerNode/
├── .gitignore
├── README.md
├── start.bat
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── routers/
│   ├── services/
│   └── models/
└── frontend/
    ├── package.json
    └── src/
        ├── app/
        ├── components/
        └── lib/
Key root files
.gitignore
Protects sensitive files (.env, credentials, tokens, local DB data, build folders, logs).

README.md
User-facing setup and architecture guide.

start.bat
Windows script that launches MongoDB, backend, and frontend in sequence.

Backend directory role
main.py: app entry point, startup configuration, likely CORS/API mount.
routers/: endpoint definitions (jobs, AI, analytics, email operations).
services/: business logic (email sweep + Gemini parsing).
models/: MongoDB schema/model layer.
requirements.txt: Python dependency lock list.
Frontend directory role
src/app/: page-level routes (dashboard, assistant, etc).
src/components/: reusable UI modules.
src/lib/: API client logic and utility helpers.
package.json: scripts + dependencies for Next.js app.
7) Technology Stack (and Why It Matters)
From README + language composition:

TypeScript (~45%)
Python (~38.9%)
CSS (~15.4%)
7.1 Frontend: Next.js 14 + React + Tailwind CSS
Why important:

Next.js gives structured routing and modern React ergonomics.
React enables dynamic dashboards and reusable components.
Tailwind speeds consistent UI development and keeps styling maintainable.
7.2 Backend: FastAPI (Python)
Why important:

High-performance async-friendly API framework.
Great for combining API endpoints with background processing.
Excellent for AI/data integrations due to Python ecosystem strength.
7.3 Database: MongoDB + Motor (async client)
Why important:

Flexible schema suits email-derived, evolving metadata.
Async database driver aligns with FastAPI async flow.
Easy local + cloud migration (Atlas).
7.4 Scheduler: APScheduler
Why important:

Enables periodic background email sweep jobs.
Supports automation without requiring manual refresh.
7.5 AI: Google Gemini
Why important:

Handles unstructured recruiter email text well.
Extracts normalized status fields from inconsistent wording.
Powers assistant tasks like summarization, cover letter generation, interview prep.
7.6 Gmail via IMAP
Why important:

Direct access to real-time application communications.
No manual CSV exports or inbox copying needed.
Works with app password security model.
8) How CareerNode Works (End-to-End Flow)
Configuration stage
User sets environment variables (MongoDB, Gmail IMAP, Gemini key).
Email ingestion
Backend authenticates with Gmail IMAP.
Scans mailbox for application-related emails.
AI extraction
Email content passed to Gemini model.
Model returns structured fields (company, role, status).
Data persistence
Backend inserts or updates records in MongoDB.
Analytics calculation
Backend computes pipeline stage distribution and conversion metrics.
Dashboard rendering
Frontend fetches APIs and visualizes progress.
Interactive assistant usage
User requests custom career help based on stored context and uploads.
9) Detailed Setup Guide (Local Machine)
9.1 Prerequisites
Install:

Node.js v18+
Python 3.10+
MongoDB (local server or Atlas)
Gemini API Key
Gmail App Password
9.2 Clone Repository
git clone https://github.com/juni2003/CareerNode.git
cd CareerNode
9.3 Backend Setup
cd backend
python -m venv venv
Activate virtual environment:

macOS/Linux:

source venv/bin/activate
Windows (PowerShell/CMD):

venv\Scripts\activate
Install dependencies:

pip install -r requirements.txt
Create backend/.env:

MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=careernode

IMAP_SERVER=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your_email@gmail.com
IMAP_PASSWORD=your_16_digit_app_password

GEMINI_API_KEY=your_gemini_api_key
FRONTEND_URL=http://localhost:3000
Run backend:

python main.py
If project expects uvicorn directly:

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
9.4 Frontend Setup
Open new terminal:

cd frontend
npm install
npm run dev
Visit: http://localhost:3000

API docs likely at: http://localhost:8000/docs

10) Gmail Setup (Very Detailed)
CareerNode uses IMAP login with Gmail app password.

10.1 Why App Password Is Required
Google blocks normal password auth for many programmatic sign-ins.
App passwords are safer short tokens for specific app access, especially with IMAP clients.

10.2 Step-by-Step: Enable Gmail Access
Log into Gmail account you want CareerNode to scan.
Go to Google Account settings.
Enable 2-Step Verification (mandatory for app passwords).
After 2FA is enabled, open App Passwords section.
Create a new app password (choose mail/other custom name e.g., “CareerNode”).
Copy generated 16-character password.
Put it in:
IMAP_PASSWORD=...
10.3 IMAP Settings Required
Use:

IMAP_SERVER=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your_email@gmail.com
IMAP_PASSWORD=your_app_password
Also confirm Gmail IMAP is enabled in Gmail settings:

Gmail → Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP.
10.4 Security Best Practices
Never commit .env or credentials to GitHub.
Rotate app password if exposed.
Use dedicated Gmail account for testing/development if needed.
Keep repository private if hosting personal pipeline data.
10.5 Common Gmail Errors + Fixes
Authentication failed
Usually wrong app password or 2FA not enabled.

IMAP connection timeout
Network/firewall issue or incorrect server/port.

No relevant emails found
Check mailbox filters, sender patterns, or parser keyword logic in backend services.

11) Environment Variables Explained
MONGODB_URL=
DATABASE_NAME=

IMAP_SERVER=
IMAP_PORT=
IMAP_USER=
IMAP_PASSWORD=

GEMINI_API_KEY=
FRONTEND_URL=
Meaning
MONGODB_URL: MongoDB connection string (local or Atlas).
DATABASE_NAME: target DB name.
IMAP_SERVER/PORT: Gmail IMAP endpoint.
IMAP_USER: Gmail address.
IMAP_PASSWORD: Gmail app password.
GEMINI_API_KEY: API key used for AI extraction/assistant features.
FRONTEND_URL: Allowed origin for backend CORS.
12) Running the Project
12.1 Manual (recommended for debugging)
Run MongoDB, backend, frontend separately so logs are visible in each terminal.

12.2 Scripted (Windows)
Use provided script:

start.bat
This attempts to:

start local MongoDB daemon,
start FastAPI via uvicorn,
start Next.js frontend,
open browser automatically.
13) Windows One-Click Startup Script (start.bat)
What it does
Assumes MongoDB executable at: C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe
Uses db path: %USERPROFILE%\data\db
Activates backend venv: backend\venv\Scripts\activate.bat
Starts backend: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
Starts frontend: npm run dev
Important assumptions
If your MongoDB version/path differs, update start.bat path accordingly.

14) Data and Security Considerations
CareerNode is explicitly a single-user app without authentication in current form.

14.1 What this means
If deployed publicly without protection, anyone with the URL may access your data.

14.2 Minimum safety rules
Do not publicly share deployed URL.
Prefer private/internal deployment access only.
Keep all secrets in platform environment variables.
Do not push .env, credential files, or token files.
Your .gitignore already protects:

backend env files
frontend env files
credential directories
local DB/log directories
15) Deployment Guide (Private Self-Hosted)
15.1 Recommended pattern
DB: MongoDB Atlas (free tier).
Backend: Render/Railway.
Frontend: Vercel.
15.2 Backend deployment checklist
Set env vars:
MONGODB_URL
DATABASE_NAME
IMAP_SERVER
IMAP_PORT
IMAP_USER
IMAP_PASSWORD
GEMINI_API_KEY
FRONTEND_URL (your Vercel domain)
15.3 Frontend deployment checklist
Set NEXT_PUBLIC_API_URL to backend deployed URL.
Ensure backend CORS allows frontend domain.
15.4 Privacy recommendation
Use password-protected preview or private network restrictions if possible since app is single-user.

16) Troubleshooting Guide
Backend not starting
Verify Python version ≥ 3.10
Ensure venv activated
Reinstall dependencies:
pip install -r requirements.txt
Frontend not starting
Verify Node ≥ 18
Delete and reinstall:
rm -rf node_modules package-lock.json
npm install
CORS issues
Ensure FRONTEND_URL exactly matches frontend origin.
No trailing mismatch (http vs https, port mismatch).
MongoDB connection failure
Check if local mongod is running.
For Atlas, ensure IP allowlist includes your machine/server.
Validate username/password in connection string.
Gmail fetch not working
Confirm IMAP enabled in Gmail settings.
Confirm app password used (not normal account password).
Confirm account has recent recruiter/application emails.
Gemini errors
Verify API key validity and quota availability.
Confirm backend receives GEMINI_API_KEY.
Add request logging around AI service calls for diagnosis.
17) Future Improvements / Roadmap Suggestions
User Authentication & Multi-Tenant Data Isolation

Required for safe public deployment.
OAuth Gmail Integration

More scalable than app-password approach.
Role-based parsing confidence metrics

Track certainty scores and allow manual correction UI.
Duplicate detection and merge logic

Avoid duplicate entries across similar email threads.
Advanced analytics

Time-to-interview, stage duration, recruiter response latency.
Notification system

Push alerts for status upgrades/interview invites.
Automated backup/restore

Scheduled DB snapshot support.
Test suite hardening

Unit tests for parsers, integration tests for endpoints.
18) Conclusion
CareerNode is a practical and high-value personal career operations tool:

It automates inbox-to-pipeline workflow,
extracts structured status data using AI,
provides real-time tracking insight,
and adds a personalized assistant layer for job search execution.
Its strongest value lies in reducing operational burden during job search while improving visibility and decision quality.

For best outcomes:

run it privately,
secure credentials carefully,
and progressively expand toward authenticated multi-user architecture if broader usage is intended.
Appendix A — Quick Commands Reference
Backend
cd backend
python -m venv venv
source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python main.py
Frontend
cd frontend
npm install
npm run dev
Windows one-click
start.bat
Appendix B — .gitignore Security Notes
Your .gitignore already correctly excludes:

Python cache and virtual env
backend/frontend .env*
credentials folders
node_modules and Next.js build artifacts
logs and local db files
IDE/OS artifacts
This is a critical protection layer and should be preserved.
