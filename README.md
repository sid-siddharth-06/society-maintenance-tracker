# Society Maintenance Tracker

## Overview
The Society Maintenance Tracker is a streamlined web application designed to bridge the communication gap between residential community members and administrators. Residents can submit, track, and review maintenance complaints, while Admins have a centralized dashboard to prioritize, resolve, and update the status of those issues. An integrated notice board keeps the community informed, and SLA tracking ensures no complaint goes unresolved for too long.

## Features
- **Resident Registration/Login:** Secure, authenticated access using NextAuth.
- **Resident Complaint Creation:** Residents can create complaints with assigned categories, descriptions, and optional photos.
- **Complaint Isolation:** Residents can only view and manage their own complaints.
- **Complaint History:** Immutable, timestamped history records track every status change.
- **Admin Complaint Management:** Admins view all complaints across the society, filter them by status/category, and update their priority and status.
- **Priority & Lifecycle:** Complaints move from `OPEN` to `IN_PROGRESS` to `RESOLVED` and can be tagged `LOW`, `MEDIUM`, or `HIGH` priority.
- **Status Notes:** Admins can append optional context notes during status transitions.
- **SLA / Overdue Detection:** Server-side logic highlights complaints exceeding the configurable resolution threshold.
- **Notice Board:** Admins can broadcast general and important notices to all residents.
- **Email Notifications:** Automated email delivery on important notices and complaint status updates.
- **Admin Dashboard:** Real-time metrics overview including total, resolved, and overdue complaints.
- **RBAC:** Server-enforced Role-Based Access Control for `ADMIN` and `RESIDENT` roles.

## Architecture
**Client / Presentation:** Next.js App Router (React, Tailwind CSS)
**Backend / API:** Next.js Server Actions and API Route Handlers
**Authentication:** Auth.js (NextAuth) securely handling JWT session cookies.
**Database ORM:** Prisma ORM with `@prisma/adapter-pg`.
**Database:** Neon PostgreSQL.
**Hosting:** Vercel (Serverless runtime).

**External Integrations:**
- **Cloudinary:** Secure, server-side upload of complaint photos.
- **Resend:** Server-side delivery of transactional email notifications.

## Technology Stack
- Next.js 16.3.2 (App Router)
- React 19 / TypeScript
- Tailwind CSS 4
- Prisma 7
- PostgreSQL (Neon) via `pg` and `@prisma/adapter-pg`
- Auth.js (NextAuth v5 beta)
- bcryptjs (Password Hashing)
- Zod (API Validation)
- Cloudinary (Image Hosting)
- Resend (Email Delivery)
- Vercel (Deployment)
- Vitest (Unit Testing)

## Account Creation and Roles

### Resident Account

Residents can create an account using:
`/register`

Public registration MUST create only a `RESIDENT` account. The client must not be able to select or submit `ADMIN` as a role. This is enforced server-side to prevent privilege escalation.

### Admin Account

Admin accounts cannot be created through the public registration page. The Admin role is provisioned through the database/seed/demo-account mechanism used by this project.

For evaluation, provide the seeded Admin credentials:
Email: `admin@example.com`
Password: `password123`

### Demo Resident Account

Email: `resident1@example.com`
Password: `password123`

> Public registration creates Resident accounts only. Users cannot register themselves as Admins. Admin authorization is enforced server-side using RBAC.

## Login Flow

Both Admin and Resident users use the SAME login page:
`/login`

The user does not select Admin or Resident manually. Authentication works as:

User enters email/password
        ↓
Auth.js verifies credentials
        ↓
Database user is identified
        ↓
Server-side role is read
        ↓
Role-based redirect

ADMIN:
→ `/admin/dashboard`

RESIDENT:
→ `/resident/complaints`

> The same `/login` page is used for both roles. The application determines the user's role from the authenticated server-side session and redirects the user accordingly.

## User Roles
**RESIDENT**
- Register and login securely.
- Create complaints with descriptions and optional photos.
- View a personalized list of their own submitted complaints.
- View the immutable status transition history of their complaints.
- View community notices.

**ADMIN**
- Login securely (Admin accounts are strictly seeded).
- View a unified dashboard with system metrics.
- View and filter all community complaints.
- Update the priority of any complaint.
- Update the status of any complaint, appending context notes.
- View the full lifecycle history of any complaint.
- Create general or important community notices.

*Note: All role checks and authorization boundaries are enforced securely server-side. The client cannot spoof their role, actor identity, or resident affiliation.*

## Complaint Lifecycle
The strict lifecycle follows three states: `OPEN` → `IN_PROGRESS` → `RESOLVED`.
- Only Admins have the authorization to execute status changes.
- Invalid state transitions are rejected by the API.
- Once a complaint is marked `RESOLVED`, it is permanently closed and can no longer be updated.
- Every successful transition automatically generates an immutable `ComplaintHistory` record inside an atomic database transaction.

## Complaint History Model
The `ComplaintHistory` model in the database ensures maximum traceability:
- Tracks `previousStatus` and `newStatus`.
- Stores the ID of the `actor` (Admin) who made the change.
- Stores an optional `note` explaining the rationale.
- The `actor` identity is derived securely from the authenticated session, ignoring any client payloads.
- It is immutable by design; the API only exposes `POST` logic tied directly to status transitions. Update/Delete endpoints do not exist.

## Overdue/SLA Logic
Service Level Agreement (SLA) logic flags complaints that have been neglected.
- The threshold is dynamically retrieved from the `SystemConfig` database table (key: `OVERDUE_THRESHOLD_DAYS`).
- Overdue detection is calculated strictly server-side: if the current time exceeds `createdAt + threshold`, it is flagged.
- `RESOLVED` complaints are automatically exempt and never marked overdue.
- Overdue complaints are prioritized at the top of the Admin sorting algorithms and aggregated into the Admin Dashboard.

## Photo Upload
- Photos are entirely optional during complaint creation.
- The client passes the photo using `multipart/form-data` to the server; the server handles the actual Cloudinary upload.
- Cloudinary API credentials (`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) remain strictly on the server and are never exposed to the browser.
- Once uploaded, Cloudinary returns a `secure_url` which is permanently stored in the `Complaint.imageUrl` database field.

## Notification Flow
**Complaint Status Change:**
Admin changes status → Database transaction commits (Complaint + History) → Resident email is queried → Resend API attempts delivery.

**Important Notice:**
Admin creates notice → Notice saved to DB → All resident emails are queried → Resend API attempts delivery.

*Note: The email delivery attempts are decoupled from the database transaction. If the Resend API fails or times out, it does not rollback the successful database operation, ensuring system resilience.*

## Database Schema
The Prisma schema utilizes PostgreSQL with the following core models:
- **User:** Stores `email`, hashed `password`, and `Role` (`ADMIN` | `RESIDENT`). Relates to complaints and history.
- **Complaint:** Stores `title`, `category`, `description`, `imageUrl`, `status`, and `priority`. Relates strictly to a `residentId`.
- **ComplaintHistory:** Immutable ledger storing `previousStatus`, `newStatus`, `note`, `timestamp`, and the `actorId`.
- **Notice:** Stores `title`, `content`, and an `isImportant` boolean flag.
- **SystemConfig:** Key-value store for application configuration (e.g., SLA threshold).
- **Notification:** Tracks the internal status of email dispatches.

## API Documentation

### Complaints
- **`POST /api/complaints`**
  - **Auth:** Resident
  - **Purpose:** Create a new complaint.
  - **Body:** `{ category, description, title?, photo? }`
- **`GET /api/complaints`**
  - **Auth:** Resident (Own only) | Admin (All)
  - **Purpose:** Fetch and filter complaints. Supports `status` and `priority` queries.
- **`GET /api/complaints/[id]`**
  - **Auth:** Resident (If owner) | Admin
  - **Purpose:** Fetch complaint details including immutable history.
- **`PATCH /api/complaints/[id]/status`**
  - **Auth:** Admin
  - **Purpose:** Transition complaint status.
  - **Body:** `{ status, note? }`
- **`PATCH /api/complaints/[id]/priority`**
  - **Auth:** Admin
  - **Purpose:** Update complaint priority.
  - **Body:** `{ priority }`

### Notices
- **`POST /api/notices`**
  - **Auth:** Admin
  - **Purpose:** Create a community notice.
  - **Body:** `{ title, content, isImportant }`
- **`GET /api/notices`**
  - **Auth:** Resident | Admin
  - **Purpose:** Fetch all notices. Important notices are pinned to the top.

### Admin Dashboard
- **`GET /api/admin/dashboard`**
  - **Auth:** Admin
  - **Purpose:** Retrieves aggregation metrics (Total, Resolved, Overdue).
- **`GET /api/admin/config/overdue`**
  - **Auth:** Admin
  - **Purpose:** Retrieves the current SLA database threshold.
- **`PATCH /api/admin/config/overdue`**
  - **Auth:** Admin
  - **Purpose:** Updates the SLA database threshold.

## Environment Variables
The following environment variables are required in production:
```
DATABASE_URL
AUTH_SECRET
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
RESEND_API_KEY
EMAIL_FROM
```

## Local Setup
1. Clone the repository and install dependencies:
   ```bash
   git clone <repository_url>
   cd society-maintenance-tracker
   npm install
   ```
2. Copy `.env.example` to `.env` and populate your specific environment variables.
3. Generate the Prisma Client and push the schema to your local database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```
4. Seed the database with the required demo accounts and configuration:
   ```bash
   npx prisma db seed
   ```
   *Note: A locally created Resident account can be created through `/register`. Admin accounts should be provisioned through the project's existing database/seed mechanism rather than public registration.*
5. Start the development server:
   ```bash
   npm run dev
   ```

## Database Setup
- The application requires a PostgreSQL database (hosted via Neon).
- Prisma ORM is strictly used for schema modeling and migrations.
- The `DATABASE_URL` provides the connection string, utilizing Neon's connection pooler for serverless compatibility.
- Ensure you run `npx prisma db seed` to establish the initial `SystemConfig` thresholds and Admin demo accounts.

## Testing
The application uses strict validation and testing:
- **Unit Tests:** `npx vitest run` (87 successful API/Auth tests)
- **Type Checking:** `npx tsc --noEmit`
- **Linting:** `npx eslint .`
- **Build Validation:** `npx next build --webpack`

## Deployment
The application is fully configured for Vercel serverless runtime deployment:
- Vercel integrates directly with the GitHub repository.
- Next.js compiles the server actions and API handlers.
- The database connects via the native `@prisma/adapter-pg` driver.
- Environment variables must be securely injected via the Vercel Dashboard.

**Production URL:** https://society-maintenance-tracker-eta-five.vercel.app

## Quick Evaluation
Evaluators can skip local deployment entirely and evaluate the live application.

Hosted Application:
https://society-maintenance-tracker-eta-five.vercel.app

Admin:
admin@example.com / password123

Resident:
resident1@example.com / password123

### Resident Evaluation

1. Open the hosted application.
2. Click Login.
3. Use:
   Email: `resident1@example.com`
   Password: `password123`
4. Verify redirect to Resident Complaints.
5. Create a complaint.
6. Select a category.
7. Enter a description.
8. Optionally upload a photo.
9. Submit the complaint.
10. Open the complaint details.
11. Verify complaint history.
12. Open Notices.
13. Verify notices.
14. Logout.

### Admin Evaluation

1. Open the hosted application.
2. Click Login.
3. Use:
   Email: `admin@example.com`
   Password: `password123`
4. Verify redirect to Admin Dashboard.
5. Verify dashboard metrics.
6. Open Complaints.
7. Locate the resident complaint.
8. Change priority.
9. Change status from OPEN to IN_PROGRESS.
10. Add an optional status note.
11. Verify history.
12. Open Notices.
13. Create a notice.
14. Mark it Important if desired.
15. Verify the notice appears.
16. Logout.

## Project Structure
```
society-maintenance-tracker/
├── prisma/                 # Database schema and seed scripts
├── public/                 # Static assets
├── src/
│   ├── app/                # Next.js App Router (Pages & API Routes)
│   ├── components/         # Reusable React components & UI
│   ├── lib/                # Core utilities (Prisma, Cloudinary, Resend, SLA logic)
│   └── modules/            # Domain-driven feature logic (Auth, Complaints, Notices)
├── package.json            # Scripts and dependencies
├── next.config.ts          # Next.js configuration
└── README.md               # Documentation
```
