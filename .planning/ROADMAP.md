# Roadmap: Roots Employee & Task Management System

## Overview

The Roots Employee & Task Management System delivers a complete, production-grade MERN stack solution for managing organizational employees, department assignments, leave schedules, and prioritized task lifecycles under strict backend business invariants. The roadmap progresses across four cohesive phases: first establishing the Express 5 and Mongoose backend core, concurrency-safe capacity engine, and automated business rule tests; second expanding the server with composable multi-criteria querying, single-trip dashboard aggregation, streaming CSV export, and standalone seeding; third constructing an authentic Apple Human Interface Guidelines design system in pure Vanilla CSS Modules, a responsive app shell, and the full employee lifecycle experience; and fourth delivering the interactive task management workflow, valid-next-status state machine, end-to-end verification, and deployment documentation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Backend Core, Schemas & Business Rules Engine** - Establish Express 5 + Mongoose foundation, enforce 8 core business rules, atomic 3-task capacity, and CRUD with Vitest rule suite (completed 2026-11-16)
- [x] **Phase 2: Server Query Engine, Dashboard Aggregation, CSV Export & Seed** - Implement multi-filter search and importance sort, single-trip dashboard aggregation, streaming CSV export, and standalone seed script (completed 2026-11-16)
- [x] **Phase 3: Apple Design System, App Shell, Dashboard & Employee Experience** - Build Vanilla CSS Modules Apple HIG tokens and UI kit, responsive shell, bento dashboard with SVG rings, and employee lifecycle flows (completed 2026-11-16)
- [x] **Phase 4: Task Management Experience, E2E Verification, Vercel & Submission Docs** - Deliver interactive task management and status transitions, end-to-end verification, dual Vercel configs, and comprehensive README architecture documentation (completed 2026-11-16)

## Phase Details

### Phase 1: Backend Core, Schemas & Business Rules Engine
**Goal**: Establish Express 5 and Mongoose backend foundation, schema models, atomic 3-task capacity enforcement, strict status state machine, and Employee/Task CRUD APIs validated by automated tests
**Depends on**: Nothing (first phase)
**UI hint**: no
**Requirements**: RULE-01, RULE-02, RULE-03, RULE-04, RULE-05, RULE-06, RULE-07, RULE-09, API-01, API-02, API-06
**Success Criteria** (what must be TRUE):
  1. Department selection is restricted strictly to the 5 valid departments (Development, Design, QA, HR, Sales) and duplicate employee ID or email submissions are rejected with HTTP 409 without any authentication requirement.
  2. Attempting to assign a task to an Inactive employee or an On Leave employee whose inclusive leave window overlaps the task's start date is deterministically rejected with HTTP 400.
  3. Status changes are rejected when submitted through normal task endpoints (POST/PUT /api/tasks) and accepted only via dedicated PUT /api/tasks/:id/status following the exact lifecycle state machine (Todo -> In Progress -> Completed, Todo | In Progress -> Cancelled), with server-authoritative completedDate and terminal lock on completed or cancelled tasks.
  4. Concurrent requests cannot assign a 4th active task (Todo + In Progress) to any employee, enforced via atomic conditional $inc on Employee.activeTaskCount, with automatic slot release upon completion, cancellation, deletion, or reassignment.
  5. Attempting to delete an employee holding active tasks is blocked with HTTP 400/409, while deleting an eligible employee preserves their identity snapshot (employeeId, fullName, email, department, role) on historical tasks.
**Plans:** 2/2 plans complete

Plans:
- [x] 01-01-PLAN.md — Initialize Node.js 24 ESM, Express 5, Mongoose 8 foundation, core error handling architecture, and Employee CRUD vertical slice with deletion guard
- [x] 01-02-PLAN.md — Implement Task vertical slice, atomic 3-task capacity, inclusive leave-window guard, status state machine, and automated Vitest test suite

### Phase 2: Server Query Engine, Dashboard Aggregation, CSV Export & Seed
**Goal**: Implement server-side search, composable multi-field filtering, importance sorting, and pagination across Employees and Tasks, build a high-performance single-trip $facet Dashboard aggregation endpoint, provide filter-aware streaming RFC-4180 CSV export with UTC overdue calculation, supply a standalone database seed script, and configure serverless Express deployment for Vercel
**Depends on**: Phase 1
**UI hint**: no
**Requirements**: RULE-08, API-03, API-04, API-05, API-07, DOC-01
**Success Criteria** (what must be TRUE):
  1. API clients can execute multi-parameter search (title, fullName), composable filtering (department, priority, status, dueDate, assignee), custom importance sorting (priorityRank), and pagination on GET /api/tasks and GET /api/employees entirely on the server.
  2. Overdue calculation (today > dueDate normalized to calendar date in UTC midnight and status not in Completed/Cancelled) is shared consistently across task queries, dashboard counts, and CSV export.
  3. GET /api/tasks/export.csv streams full RFC-4180 compliant CSV output matching the active filter and search criteria (including overdue flag and preserved former employee details) rather than only the paginated view.
  4. GET /api/dashboard delivers all organizational metrics (employee status counts, task status counts, department/priority distributions, overdue spotlight, and per-employee workload ratios 0..3) in a single server aggregation call.
  5. Developers can spin up the backend locally against standalone MongoDB out of the box, populate clean demo data via npm run seed, and deploy serverless functions via server/api/index.js and server/vercel.json.
**Plans:** 2/2 plans complete

Plans:
- [x] 02-01-PLAN.md — Shared UTC overdue engine, composable server query engine, pagination, and streaming RFC-4180 CSV export
- [x] 02-02-PLAN.md — Server dashboard aggregation, metadata endpoint, standalone seed script, Vercel serverless config, and automated tests

### Phase 3: Apple Design System, App Shell, Dashboard & Employee Experience
**Goal**: Create an Apple Human Interface Guidelines design system in pure Vanilla CSS Modules with custom design tokens, establish the responsive navigation shell (macOS frosted sidebar, iPadOS collapsible rail, iOS bottom tab bar), build the Bento dashboard with zero-inline-style SVG capacity rings and charts, and deliver the complete employee management lifecycle (list with URL persistence, creation/edit with leave validation, and creative profile view)
**Depends on**: Phase 2
**UI hint**: yes
**Requirements**: UI-01, UI-02, UI-03, UI-04, FE-01, FE-02, FE-03
**Success Criteria** (what must be TRUE):
  1. Users experience an Apple HIG visual system featuring SF Pro / Inter typography, translucent vibrancy, light/dark modes, and CSS spring micro-interactions with zero inline JSX/DOM styles (style={{}}) and zero Tailwind.
  2. The responsive application shell seamlessly adapts across desktop macOS sidebar (>1024px), tablet collapsible rail (768–1024px), and mobile iOS tab bar (<768px) with distinct React Router routes for all views.
  3. The Dashboard screen (/) displays real-time bento metrics, custom SVG status/priority/department charts, overdue task spotlights, and Apple Watch Activity-style capacity rings (0/3 to 3/3) indicating employee workload.
  4. Employee management enables filtering, sorting, and pagination synchronized with the browser URL query string, form inputs with dynamic leave date ordering validation, deletion confirmation modals, and a rich profile view with skills pills and visual leave timeline.
**Plans**: TBD

### Phase 4: Task Management Experience, E2E Verification, Vercel & Submission Docs
**Goal**: Implement the complete task management experience (URL-persisted task list, filtered CSV export trigger, validation-safe creation/edit forms, valid-next-status dropdowns, and interactive task detail timeline with former employee snapshots), conduct end-to-end integration and verification, configure dual Vercel deployments, and produce submission-ready documentation answering all 6 mandatory architectural questions
**Depends on**: Phase 3
**UI hint**: yes
**Requirements**: FE-04, FE-05, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):
  1. Users can search, filter, and sort tasks with full URL query persistence, trigger instant streaming CSV export of all matching tasks, and create/edit tasks with real-time employee capacity and leave-window warnings.
  2. Task status changes in both list and detail views offer only valid next transitions according to the state machine, disable editing on completed/cancelled tasks, and display friendly toast feedback reflecting server business rule violations.
  3. The Task Detail view presents an interactive status stepper timeline, overdue callout badge, and clear "Former Employee" snapshot indicators when an assigned employee has been deleted.
  4. The complete system deploys seamlessly to Vercel via separate client/ and server/ configs with clean .env.example templates, while README.md thoroughly documents local setup, schemas, deletion snapshots, and answers all 6 architectural questions.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Core, Schemas & Business Rules Engine | 2/2 | Complete    | 2026-11-16 |
| 2. Server Query Engine, Dashboard Aggregation, CSV Export & Seed | 2/2 | Complete    | 2026-11-16 |
| 3. Apple Design System, App Shell, Dashboard & Employee Experience | 1/1 | Complete    | 2026-11-16 |
| 4. Task Management Experience, E2E Verification, Vercel & Submission Docs | 1/1 | Complete    | 2026-11-16 |
