# AI Smart Complaint Management System

Full-stack MERN + AI complaint management platform with authentication, complaint workflow, AI categorization, status tracking, image upload hooks, and analytics.

## Complete Workflow Diagram

```text
Citizen submits complaint
	↓
AI analyzes text and image
	↓
AI predicts category + priority
	↓
Admin reviews complaint
	↓
Admin assigns worker
	↓
Worker resolves issue
	↓
Status update sent to citizen
```

Example:

```text
Complaint: Big pothole on the road
AI Result: Category -> Road Department, Priority -> High
```

## Website UI Design Structure

1. Home Page
- Intro section
- Login/Register buttons
- Submit Complaint CTA
- Feature summary cards

2. User Dashboard
- Submit complaint button
- My complaints list
- Status overview

3. Submit Complaint Page
- Title
- Description
- Image upload
- Location fields
- Submit action

4. Admin Dashboard
- Total, pending, resolved, high-priority cards
- Complaint list and filters
- Worker assignment and status actions

5. Worker Dashboard
- Assigned task queue
- Progress updates
- Completion image upload

6. Complaint Tracking Page
- Submitted -> Under Review -> In Progress -> Resolved timeline

## Project Structure

- frontend: React + Tailwind + Chart.js UI
- backend: Node.js + Express + MongoDB API
- ai-model: Python FastAPI + scikit-learn classifier
- dataset: CSV training dataset for complaint classification
- docker-compose.yml: One-command local orchestration

## Core Features

- User signup/login (user and admin roles)
- Access token + refresh token auth flow
- Complaint submission with AI classification
- Complaint image attachment hook
- Complaint status tracking
- Admin complaint management
- Analytics dashboard with pie, bar, and line charts
- Hierarchical governance flow: village -> mandal -> district -> state -> nation
- Real-time notifications using Socket.io
- Auto-escalation scheduler for overdue unresolved complaints
- Admin security activity logs and summary APIs
- Worker assignment workflow and progress updates

## Advanced Features Included

- AI categorization and priority prediction
- Duplicate/recurrence tracking via complaint history
- Real-time admin/citizen notification channel (Socket.io)
- Hierarchical escalation pipeline
- Admin security activity logs
- Analytics for trends and response performance

## Option A: Run With Docker

1. Open terminal at project root.
2. Start all services:

```bash
docker compose up --build
```

3. Open apps:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- AI API: http://localhost:8000

4. Stop services:

```bash
docker compose down
```

## Option B: Run Manually

### 1) Backend

1. Open terminal in backend.
2. Install dependencies:

```bash
npm install
```

3. Create .env file from .env.example.
4. Start backend:

```bash
npm run dev
```

5. (Optional) Seed demo hierarchy and sample complaints:

```bash
npm run seed
```

Backend runs on http://localhost:5000.

### 2) AI Model

1. Open terminal in ai-model.
2. Create and activate virtual environment.
3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Train model:

```bash
python train_model.py
```

5. Start AI API:

```bash
uvicorn predict:app --reload --host 127.0.0.1 --port 8000
```

AI API runs on http://127.0.0.1:8000.

### 3) Frontend

1. Open terminal in frontend.
2. Install dependencies:

```bash
npm install
```

3. Create .env file from .env.example.
4. Start frontend:

```bash
npm start
```

Frontend runs on http://localhost:3000.

## Deploy Frontend On Vercel

This frontend uses React Router with client-side routes such as `/login` and `/dashboard`.
When deploying to Vercel, the project must be configured as a single-page app so direct route visits do not return 404.

Required Vercel settings:

- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `build`

The repository includes [frontend/vercel.json](frontend/vercel.json) with a rewrite rule that sends all routes to `index.html`.

Frontend environment variable for deployed builds:

```env
REACT_APP_API_URL=https://your-backend-domain/api
```

## API Overview

Auth:
- POST /api/auth/signup
- POST /api/auth/login
- POST /api/auth/refresh
- POST /api/auth/logout

Complaints:
- POST /api/complaints
- GET /api/complaints/mine
- POST /api/complaints/:id/image
- GET /api/complaints (admin)
- PATCH /api/complaints/:id/status (admin)
- GET /api/complaints/analytics (admin)

Admin:
- GET /api/admin/activities
- GET /api/admin/activities/security-summary
- POST /api/admin/collector/question-lower-admins

Notifications:
- GET /api/notifications
- PATCH /api/notifications/:id/read
- PATCH /api/notifications/read-all

Health:
- GET /health

## Automated Tests

Backend:

```bash
cd backend
npm test
```

Frontend:

```bash
cd frontend
npm test
```

## Database Schema

User:
- name
- email
- password
- role
- refreshToken

Complaint:
- userId
- complaintText
- category
- priority
- department
- status
- sentiment
- images[]
- createdAt

## Notes

- If AI service is unavailable, backend uses safe default classification.
- Status flow: Submitted -> Under Review -> In Progress -> Resolved -> Closed
- Recommended role for first test admin user: signup with role = admin
- Backend scheduler checks overdue complaints and escalates them automatically (default every 15 minutes).
- Docker compose includes health checks for MongoDB, AI model, backend, and frontend services.
