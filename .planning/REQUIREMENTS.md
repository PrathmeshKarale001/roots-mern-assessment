# Requirements: Roots Employee & Task Management System

**Defined:** 2026-11-16
**Core Value:** Every Employee & Task business rule is enforced deterministically on the backend (including under concurrent requests and standalone local MongoDB) and presented through a responsive, zero-inline-style Apple-inspired interface with full URL state persistence.

## v1 Requirements

Requirements for the complete technical assignment submission. Every requirement maps to a roadmap phase.

### Backend Business Rules (`RULE`)

- [x] **RULE-01**: System restricts departments strictly to `Development`, `Design`, `QA`, `HR`, and `Sales`, and requires no login/authentication anywhere in the app.
- [x] **RULE-02**: Backend rejects assigning a task to an `Inactive` employee (`400`) and rejects assigning to an `On Leave` employee (`400`) when the task's `startDate` falls within `[leaveStart, leaveEnd]` (both dates inclusive, normalized to calendar dates).
- [x] **RULE-03**: Backend validates date ordering (`dueDate >= startDate` on tasks; `leaveEnd >= leaveStart` required when employee is `On Leave`, cleared to `null` otherwise) and returns `400` on violation.
- [x] **RULE-04**: New tasks always start in `Todo`, status changes are permitted ONLY via `PUT /api/tasks/:id/status` following `Todo -> In Progress -> Completed` and `Todo | In Progress -> Cancelled`, and any `status` field sent to `POST /api/tasks` or `PUT /api/tasks/:id` is rejected (`400`).
- [x] **RULE-05**: Tasks in `Completed` or `Cancelled` status are permanently locked—any edit (`PUT /api/tasks/:id`) or further status change (`PUT /api/tasks/:id/status`) is rejected (`400`).
- [x] **RULE-06**: `completedDate` is set exclusively by the backend when a task transitions to `Completed` and any client-supplied `completedDate` is rejected/ignored (`400`).
- [x] **RULE-07**: An employee can hold at most 3 active tasks (`Todo` + `In Progress`) simultaneously, enforced via single-document atomic conditional `$inc` on `Employee.activeTaskCount` so two concurrent requests cannot assign a 4th active task, with accurate slot release/transfer on task completion, cancellation, deletion, or reassignment.
- [ ] **RULE-08**: Overdue status (`today > dueDate` in normalized calendar dates AND `status` not in `Completed`/`Cancelled`) is computed via one shared server utility/predicate and surfaced identically in Task List, Task Detail, Dashboard, and CSV Export.
- [x] **RULE-09**: Deleting an employee (`DELETE /api/employees/:id`) is blocked (`400`/`409`) while they hold any `Todo` or `In Progress` task; once eligible and deleted, historical tasks preserve and display meaningful employee details via `assigneeSnapshot` (`employeeId`, `fullName`, `email`, `department`, `role`).

### Backend APIs, Querying & Data (`API`)

- [x] **API-01**: Employee CRUD endpoints (`GET /api/employees`, `POST /api/employees`, `GET /api/employees/:id`, `PUT /api/employees/:id`, `DELETE /api/employees/:id`, `GET /api/employees/:id/tasks`) enforce unique `employeeId` and lowercase-normalized unique `email` (`409` on duplicate) and sync `assigneeSnapshot` on profile edits.
- [x] **API-02**: Task CRUD & status endpoints (`GET /api/tasks`, `POST /api/tasks`, `GET /api/tasks/:id`, `PUT /api/tasks/:id`, `DELETE /api/tasks/:id`, `PUT /api/tasks/:id/status`) auto-generate sequential `TSK-0001` IDs via an atomic `Counter` collection.
- [ ] **API-03**: Server-side search (`title` and employee `fullName`), composable filters (`department`, `priority`, `status`, `dueDate` modes/ranges, `assignee`), sorting (`createdAt`, `dueDate`, `priority` by importance via `priorityRank`, `title`), and pagination (`page`, `limit`, `total`, `totalPages`) work together on `GET /api/tasks` (and search/department/status/sort/pagination on `GET /api/employees`).
- [ ] **API-04**: `GET /api/tasks/export.csv` (mounted above `/:id`) streams RFC-4180 CSV (with UTF-8 BOM) for ALL tasks matching the active search/filter/sort parameters (not just the current page), including `Overdue` and preserved deleted-employee details.
- [ ] **API-05**: `GET /api/dashboard` computes all summary counts (total/active/on-leave/inactive employees, total/todo/in-progress/completed/cancelled/overdue tasks, department & priority breakdowns, recent overdue tasks, and per-employee active workload `0..3`) on the server via MongoDB aggregation.
- [x] **API-06**: Central error middleware returns structured JSON errors with accurate HTTP status codes (`400` validation or broken business rule, `404` resource/route not found or invalid ObjectId, `409` duplicate `employeeId`/`email` or blocked employee deletion).
- [ ] **API-07**: Automated backend test suite (`Vitest` + `Supertest` + `mongodb-memory-server`) verifies every business rule, concurrent 4th-task race protection, query composition, dashboard math, and CSV export.

### Apple Design System & Frontend Architecture (`UI`)

- [ ] **UI-01**: Apple HIG design system implemented in pure Vanilla CSS Modules + `tokens.css` (SF Pro / Inter typography, translucent frosted vibrancy, grouped inset cards, semantic system colors, CSS `linear()` springs, Light/Dark/System theme toggle) with **zero inline styles (`style={{}}`)** and **zero Tailwind**.
- [ ] **UI-02**: Responsive layout adapts cleanly across Mobile (`<768px` iOS bottom tab bar + card lists), Tablet (`768–1024px` collapsible rail), and Desktop (`>1024px` macOS Sequoia frosted sidebar) without copying the assignment PDF's wireframe layout.
- [ ] **UI-03**: Reusable UI component library (`Button`, `Input`, `Select`, `SegmentedControl`, `Badge`, `CapacityRing`, `Modal`, `ActionMenu`, `Pagination`, `Skeleton`, `EmptyState`, `ErrorBanner`) with consistent file naming and feature-sliced architecture.
- [ ] **UI-04**: Dashboard screen (`/`) renders server-driven bento stat cards, custom zero-inline-style SVG status/priority/department charts, Apple Watch Activity-style employee workload rings (`0/3..3/3`), and actionable overdue task spotlight.

### Frontend Workflows & URL State (`FE`)

- [ ] **FE-01**: Multi-page React Router v7 navigation provides distinct routes for Dashboard (`/`), Employee List (`/employees`), Add Employee (`/employees/new`), Edit Employee (`/employees/:id/edit`), View Employee (`/employees/:id`), Task List (`/tasks`), Add Task (`/tasks/new`), Edit Task (`/tasks/:id/edit`), and View Task (`/tasks/:id`).
- [ ] **FE-02**: Search, filters, sorting, and `page` number persist in the browser URL query string (e.g., `/tasks?status=In%20Progress&priority=High&page=2`) on both `/tasks` and `/employees` so refreshing or opening a copied URL restores the exact same server-queried view.
- [ ] **FE-03**: Employee List, Add/Edit forms (with conditional `leaveStart`/`leaveEnd` fields when `On Leave` and skill tag input), delete confirmation modal, and creative Employee Profile View (hero card, skills, visual leave window, capacity ring, assigned tasks list + quick assign CTA) work end-to-end with frontend + backend validation.
- [ ] **FE-04**: Task List, Add/Edit forms (without editable `status` or `completedDate`, showing live employee capacity/leave hints), filter-synced `Export CSV` action, and creative Task Detail View (interactive status stepper timeline, overdue callout, and `"Former Employee"` snapshot badge when deleted) work end-to-end.
- [ ] **FE-05**: Task status controls (in both Task List and Task Detail) offer ONLY valid next transitions (`Todo -> In Progress | Cancelled`, `In Progress -> Completed | Cancelled`, locked badge for `Completed`/`Cancelled`), and all API mutations display loading states plus friendly toast/banner notifications surfacing exact backend error messages.

### Deployment, Seed & Documentation (`DOC`)

- [ ] **DOC-01**: Backend runs out of the box against local MongoDB (`mongodb://127.0.0.1:27017/roots_ems`), includes an optional standalone `npm run seed` script (strictly separate from app runtime), and exports a cached-connection Express app at `server/api/index.js` with `server/vercel.json`.
- [ ] **DOC-02**: Frontend includes `client/vercel.json` SPA rewrites preserving deep links and query parameters on refresh, environment-driven `VITE_API_URL`, and clean `.env.example` files in both `server/` and `client/` with zero committed secrets.
- [ ] **DOC-03**: Root `README.md` documents setup, environment variables, API overview, MongoDB schemas & Employee -> Task relationship, employee deletion snapshot strategy, Vercel deployment steps, assumptions, and clear answers to all 6 mandatory architectural questions.

## v2 Requirements

Deferred beyond the assessment scope.

- **NOTF-01**: Automated email/Slack reminders when tasks approach due dates
- **AUDIT-01**: Full immutable audit log collection for every field edit on Employee and Task documents
- **BULK-01**: Multi-select batch task reassignment and CSV employee import

## Out of Scope

| Feature | Reason |
|---------|--------|
| Login / Authentication / RBAC | Explicitly excluded by the assignment PDF ("No login/authentication is required") |
| Client-side filtering / sorting / pagination | Explicitly penalized in Negative Points rubric |
| Status or `completedDate` editable in normal Task Update API | Explicitly forbidden by business rules |
| Runtime hardcoded mock data | Explicitly penalized in Negative Points rubric |
| Inline JSX/DOM styles (`style={{}}`) | Explicitly penalized in Negative Points rubric |

## Traceability

Populated and validated by `gsd-roadmapper`.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RULE-01 | Phase 1 | Complete |
| RULE-02 | Phase 1 | Complete |
| RULE-03 | Phase 1 | Complete |
| RULE-04 | Phase 1 | Complete |
| RULE-05 | Phase 1 | Complete |
| RULE-06 | Phase 1 | Complete |
| RULE-07 | Phase 1 | Complete |
| RULE-08 | Phase 2 | Pending |
| RULE-09 | Phase 1 | Complete |
| API-01 | Phase 1 | Complete |
| API-02 | Phase 1 | Complete |
| API-03 | Phase 2 | Pending |
| API-04 | Phase 2 | Pending |
| API-05 | Phase 2 | Pending |
| API-06 | Phase 1 | Complete |
| API-07 | Phase 2 | Pending |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| FE-01 | Phase 3 | Pending |
| FE-02 | Phase 3 | Pending |
| FE-03 | Phase 3 | Pending |
| FE-04 | Phase 4 | Pending |
| FE-05 | Phase 4 | Pending |
| DOC-01 | Phase 2 | Pending |
| DOC-02 | Phase 4 | Pending |
| DOC-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0 ✓

---
*Requirements defined: 2026-11-16*
*Last updated: 2026-11-16 after initial definition*
