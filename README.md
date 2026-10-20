# CloudClass — MCA Semester III DSCC Mini Project

**Project title:** CloudClass: Cloud-Based Student Assignment and File Management System  
**Course context:** University of Mumbai, MCA Semester III, Distributed System & Cloud Computing (DSCC), NEP 2020 (2025–26 syllabus version)  
**Team size:** 2–3 students

## 1. Abstract

CloudClass is a web-based classroom resource and assignment management system. Teachers publish assignments and optional learning files; students access those resources and submit their work; teachers review submissions. The frontend is deployed to a cloud hosting platform, while authentication, relational data and private file objects are managed by Supabase.

The project demonstrates cloud service models, client-server communication, managed database services, cloud object storage, identity management, access control, and deployment. It is an academic demonstration, not a production learning-management system.

## 2. Objectives

- Demonstrate a web client communicating with remote managed cloud services.
- Use authentication and role-based permissions.
- Store assignment metadata in a relational database and files in object storage.
- Deploy the frontend and access it through a public HTTPS URL.
- Measure basic request/response performance and discuss availability and scaling.
- Relate the implementation to DSCC topics including cloud architecture, SaaS/PaaS/DBaaS, distributed file access, identity management, security and QoS.

## 3. Technology

- React + Vite: frontend
- Supabase Auth: authentication
- Supabase PostgreSQL: relational database
- Supabase Storage: private object storage
- PostgreSQL Row Level Security (RLS): authorization
- Vercel: frontend hosting and deployment
- Git + GitHub: source control and team collaboration

Free tiers and limits can change. Check provider plans before deployment. Supabase free projects may pause after inactivity; Vercel Hobby has plan-specific usage and use restrictions.

## 4. Prerequisites

Install:
- Node.js LTS (includes npm)
- Git (recommended)
- A GitHub account
- A Supabase account
- A Vercel account for deployment

## 5. Local setup

1. Extract the project ZIP.
2. Open a terminal in the `CloudClass_DSCC` folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Create a Supabase project at https://supabase.com.
5. Open the Supabase project's **SQL Editor**.
6. Open `supabase/schema.sql`, copy its full contents, paste into SQL Editor and run it.
7. In Supabase **Project Settings → API** (or the project's Connect/API panel), copy the project URL and the publishable/anon key.
8. Copy `.env.example` to a new file named `.env` in the project root. Fill in:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
   ```

   Use only the publishable/anon client key in the browser. Never use the `service_role` secret in a Vite environment variable or commit any secret key.

9. Start the development server:

   ```bash
   npm run dev
   ```

10. Open the local URL printed by Vite (normally `http://localhost:5173`).

## 6. Create a teacher account

New signups are deliberately assigned the `student` role. Do not allow public users to select a teacher role.

1. Sign up with the email intended for the teacher.
2. If email confirmation is enabled, confirm the email.
3. In Supabase Dashboard → Authentication → Users, find that account and copy its UUID.
4. In SQL Editor run (replace the sample UUID):

   ```sql
   update public.profiles
   set role = 'teacher'
   where id = 'PASTE-TEACHER-UUID-HERE';
   ```

5. Sign out and sign in again. The teacher dashboard can now create assignments and review submissions.

To promote a student to teacher, only a trusted project administrator should run this SQL. Do not add a public role-changing UI.

## 7. Functional demonstration

### Student
1. Create an account and sign in.
2. View assignments.
3. Download assignment material when attached.
4. Upload a submission file (maximum 10 MB).
5. Open “My submissions” to check its status.

### Teacher
1. Sign in using the teacher account configured above.
2. Select Assignments → New assignment.
3. Enter title, description and optional deadline.
4. Optionally attach a PDF, Word document, PowerPoint, text or image file.
5. Publish the assignment.
6. Open Student work and download a submission.
7. Mark a submission as reviewed.

## 8. Database design

### profiles
- `id`: primary key, same UUID as Supabase Auth user
- `full_name`: display name
- `role`: student, teacher or admin
- `created_at`: account creation time

### assignments
- `id`: primary key
- `title`, `description`, `deadline`
- `file_path`: object path in private storage, nullable
- `created_by`: teacher profile ID
- `created_at`

### submissions
- `id`: primary key
- `assignment_id`: foreign key to assignments
- `student_id`: foreign key to profiles
- `file_path`: object path in private storage
- `status`: submitted or reviewed
- `submitted_at`
- unique `(assignment_id, student_id)` so a student has one current submission per assignment; uploading again replaces the submission record.

## 9. Architecture

```text
Student / Teacher browser
          |
          | HTTPS
          v
React + Vite frontend (Vercel)
          |
          +------ Supabase Auth (identity)
          |
          +------ Supabase PostgreSQL (assignments/submissions)
          |
          +------ Supabase Storage (private files)
                         |
                  Signed download URLs
```

The browser uses the Supabase client to call hosted services over HTTPS. PostgreSQL stores structured metadata. Storage holds file contents, not file blobs inside database rows. RLS policies enforce permissions at the database and storage layers.

## 10. DSCC syllabus mapping

| DSCC concept | CloudClass demonstration |
|---|---|
| Distributed system architecture | Frontend, authentication, database and object storage are separate network services |
| Client-server communication / remote calls | Browser sends HTTPS requests to managed APIs |
| Cloud computing architecture | Application, identity, data and storage layers |
| SaaS | CloudClass is offered as an online classroom service |
| PaaS | Managed frontend build and deployment through Vercel |
| DBaaS | Managed PostgreSQL via Supabase |
| Storage as a Service | Supabase private object storage |
| Identity management | Auth users and student/teacher roles |
| Security | RLS policies, private bucket and signed URLs |
| QoS / performance | Measure response time and upload/download success |
| Scalability | Explain how managed services separate app, data and file workloads |
| Virtualization / IaaS | Optional separate VM experiment; not implemented by the main stack |

**Academic honesty note:** This project uses managed services; it does not implement a distributed file system, RPC runtime, consensus algorithm, VM hypervisor or load balancer from scratch. Explain the distinction clearly in the viva.

## 11. Test plan

| Test | Expected result |
|---|---|
| Register a new student | Profile is created with student role |
| Student tries to create an assignment | Database rejects the insert |
| Teacher creates an assignment | Assignment appears for authenticated users |
| Student uploads work | File and submission record are created |
| Student attempts to read another student's submission | RLS denies the unauthorized row |
| Download a private file | Authenticated, short-lived signed URL is generated |
| Upload file over 10 MB | App rejects it; storage also enforces a 10 MB limit |
| Refresh after deployment | Data remains because it is stored in managed services |
| Open the app in two browsers | Both access the same cloud-hosted assignment data |

Verify these tests yourself before claiming they passed. Record actual results in the report.

## 12. Basic performance experiment

For 10–20 trials, record the time for:
- loading the assignment list,
- creating an assignment,
- uploading a small file,
- downloading a file.

Record the observed times in milliseconds, then calculate:

`Average response time = sum of measured times / number of trials`

Run tests under the same network conditions and record file sizes. This is a small classroom experiment, not a formal cloud benchmark.

## 13. Work division

### Two members
- Member A: UI, React components and responsive design.
- Member B: Supabase schema, authentication, RLS, storage and deployment.
- Both: integration, tests, report and viva.

### Three members
- Member A: frontend and dashboards.
- Member B: database, auth, RLS and storage integration.
- Member C: deployment, testing, performance experiment, diagrams and documentation.
- All members: code review and final demonstration.

## 14. Four-week schedule

- Week 1: requirements, architecture, Git repository, database and authentication.
- Week 2: assignment creation, cloud file upload and student submissions.
- Week 3: RLS/security checks, deployment and cross-browser testing.
- Week 4: performance experiment, screenshots, diagrams, report and viva.

## 15. Limitations and future scope

- Current version supports one submission record per student per assignment.
- Teacher accounts must be promoted by a trusted administrator.
- No email notifications, grading rubric, course enrollment or real-time collaboration.
- No custom RPC/RMI implementation or VM provisioning.
- Future improvements: course enrollment, marks/feedback, notifications, file version history, audit logs, automated tests and optional IaaS deployment.

## 16. Viva questions

1. What is cloud computing, and why is it used in this project?
2. Distinguish IaaS, PaaS and SaaS with examples from the implementation.
3. Why use PostgreSQL for metadata and object storage for files?
4. What is identity management?
5. What is Row Level Security, and why is frontend-only role checking insufficient?
6. What is a signed URL, and why should it expire?
7. How does the project demonstrate a distributed application?
8. What is the difference between availability and scalability?
9. What would change if the application had 10,000 concurrent users?
10. Which DSCC concepts are demonstrated directly, and which are only discussed?

## 17. Final submission checklist

- [ ] Project runs locally using `npm run dev`
- [ ] SQL schema executed successfully
- [ ] Student signup and sign-in work
- [ ] Teacher role configured securely
- [ ] Assignment creation works
- [ ] Student file upload and status view work
- [ ] RLS and private storage tests performed
- [ ] Public deployment tested
- [ ] Architecture and ER diagrams included
- [ ] Screenshots and real test results included
- [ ] Every group member can explain the design
