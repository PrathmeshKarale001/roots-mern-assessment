# Architecture Research

**Domain:** Full-Stack Employee & Task Management System (MERN Monorepo with Strict Server-Enforced Invariants)
**Researched:** 2026-11-16
**Confidence:** HIGH

## Standard Architecture

### System Overview

The Roots Employee & Task Management System uses a decoupled two-tier SPA + REST API architecture organized as a clean `client/` and `server/` monorepo. All domain invariants, capacity concurrency guards, date-boundary checks, status transitions, aggregations, filtering, sorting, pagination, and CSV generation live exclusively on the Express/Mongoose backend. The React SPA acts as a reactive projection of URL query parameters and server state, styled with Apple Human Interface Guidelines (HIG) design tokens and Vanilla CSS Modules.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Vite + React SPA)                            │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐  │
│  │   AppShell Layout    │  │   Feature Modules    │  │   UI Primitives    │  │
│  │  macOS Glass Sidebar │  │  • dashboard/        │  │  • Button, Select  │  │
│  │  Tablet Rail/Drawer  │  │  • employees/        │  │  • DataTable, Card │  │
│  │  iOS Bottom Tab Bar  │  │  • tasks/            │  │  • StatusSelect    │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  │  • Toast, Skeleton │  │
│             │                         │              └─────────┬──────────┘  │
│  ┌──────────┴─────────────────────────┴────────────────────────┴──────────┐  │
│  │          State & Routing Layer (URL-First + Server Cache)              │  │
│  │  React Router v7 (useSearchParams) ──► useUrlFilters(zodSchema)        │  │
│  │  TanStack Query v5 (queryKey: [entity, filters], keepPreviousData)     │  │
│  │  React Hook Form + Zod (client UX validation; server errors surfaced)  │  │
│  └────────────────────────────────────┬───────────────────────────────────┘  │
└───────────────────────────────────────┼──────────────────────────────────────┘
                                        │ HTTPS / JSON & text/csv
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                      SERVER (Node.js + Express REST API)                     │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐   ┌───────────────────┐   ┌─────────────────────────────┐  │
│  │    Routes    │──►│  Zod Validate MW  │──►│   Thin HTTP Controllers     │  │
│  │ /employees   │   │  body/query/param │   │  Parse req, call service,   │  │
│  │ /tasks       │   │  strips status &  │   │  format JSON or pipe CSV    │  │
│  │ /dashboard   │   │  completedDate    │   └──────────────┬──────────────┘  │
│  └──────────────┘   └───────────────────┘                  │                 │
│                                                            ▼                 │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                    Domain Services & Shared Engines                    │  │
│  │  • employee.service  (email norm, leave rules, delete guard, sync)     │  │
│  │  • task.service      (atomic $inc capacity, leave check, state flow)   │  │
│  │  • dashboard.service ($facet counts, overdue count, workload ranking)  │  │
│  │  • taskQuery.builder (shared by GET /api/tasks & GET /tasks/export.csv)│  │
│  │  • date.utils        (UTC YYYY-MM-DD normalization & overdue engine)   │  │
│  └──────────────┬──────────────────────────────────────────┬──────────────┘  │
│                 │                                          │                 │
│  ┌──────────────▼──────────────┐            ┌──────────────▼──────────────┐  │
│  │   Central Error Pipeline    │            │    Mongoose ODM Layer       │  │
│  │  ApiError (400 / 404 / 409) │            │  Connection Singleton Cache │  │
│  │  ZodError / E11000 Mapper   │            │  Schema Indexes & Hooks     │  │
│  └─────────────────────────────┘            └──────────────┬──────────────┘  │
└────────────────────────────────────────────────────────────┼─────────────────┘
                                                             │
                                                             ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│               DATA STORE (Local Standalone mongod / MongoDB Atlas)           │
│  ┌────────────────────┐  ┌────────────────────────┐  ┌────────────────────┐  │
│  │     employees      │  │         tasks          │  │      counters      │  │
│  │  activeTaskCount   │◄─┤  assignee (ObjectId)   │  │  _id: "taskId"     │  │
│  │  leaveStart/End    │  │  assigneeSnapshot {...}│  │  seq: 1..N         │  │
│  │  unique email/id   │  │  priorityRank (1..4)   │  └────────────────────┘  │
│  └────────────────────┘  └────────────────────────┘                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Express App & Entrypoints** | Configures CORS, security headers, JSON body limits, route mounting, 404 fallback, and centralized error middleware; supports both local daemon and Vercel serverless execution. | `server/src/app.js` (pure Express instance for Supertest + serverless), `server/src/server.js` (local `app.listen`), `server/api/index.js` (Vercel handler). |
| **Validation Middleware** | Validates and coerces `req.params`, `req.query`, and `req.body` before controllers run; strips or rejects forbidden fields (`status`, `completedDate` on task create/edit). | Reusable `validate({ body, query, params })` Express middleware backed by Zod schemas; throws `ApiError.badRequest` (`400`) with field-level details. |
| **HTTP Controllers** | Thin transport adapters: extract validated inputs, invoke domain service methods, return standardized `{ success: true, data, meta }` envelopes or stream CSV headers/rows. | Stateless async functions wrapped with `asyncHandler` (or Express 5 native promise forwarding) containing zero business logic or Mongoose queries. |
| **Domain Services** | Own all 8 assignment business rules, atomic capacity claims, compensating rollbacks, status transition validation, snapshot synchronization, and dashboard `$facet` pipelines. | `employee.service.js`, `task.service.js`, `dashboard.service.js` throwing typed `ApiError` (`400`, `404`, `409`). |
| **Shared Query & Overdue Engine** | Guarantees identical filtering, regex search, importance sorting, and UTC calendar-day overdue semantics across list API, detail API, dashboard API, and CSV export. | `taskQuery.builder.js` (`buildTaskFilterQuery`, `buildTaskSortSpec`) + `date.utils.js` (`parseUtcDateOnly`, `getUtcToday`, `computeIsOverdue`, `buildOverdueMongoCondition`). |
| **Mongoose Models** | Define document schemas, unique/compound indexes, enum constraints, normalized fields, embedded snapshots, and atomic sequence generation. | `Counter`, `Employee`, `Task` models in `server/src/models/`, backed by cached `connectDB()` singleton for serverless warm reuse. |
| **URL Filter Hook (`useUrlFilters`)** | Synchronizes search, multi-field filters, sort field/order, and pagination directly with URL query parameters (`?status=In%20Progress&priority=High&page=2`). | Custom hook wrapping React Router `useSearchParams` + Zod `.catch()` defaults; resets `page` to `1` on filter changes and feeds TanStack Query keys. |
| **Feature Modules (`features/*`)** | Encapsulate domain-specific API functions, TanStack Query keys/hooks, Zod form schemas, domain components, and route pages per vertical slice. | `features/dashboard`, `features/employees`, `features/tasks` importing shared primitives from `components/ui/`. |
| **UI Primitives & Design Tokens** | Deliver Apple HIG visual polish (frosted glass vibrancy, grouped inset cards, semantic badges, workload rings, responsive navigation) with zero inline styles. | `styles/tokens.css` (CSS custom properties for light/dark themes) + `components/ui/*.module.css` scoped component styles. |

## Recommended Project Structure

```
HRootsMERNAssessment/
├── server/                                  # Backend Node.js + Express + Mongoose API
│   ├── api/
│   │   └── index.js                         # Vercel serverless entrypoint (connects DB & exports app)
│   ├── scripts/
│   │   └── seed.js                          # Standalone optional seed script (npm run seed; never imported at runtime)
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js                       # Zod-validated environment configuration (PORT, MONGODB_URI, CORS_ORIGIN)
│   │   │   └── db.js                        # Cached Mongoose connection singleton (global.mongooseCache)
│   │   ├── constants/
│   │   │   └── domain.js                    # Shared enums: DEPARTMENTS, EMPLOYEE_STATUSES, TASK_STATUSES, PRIORITIES, PRIORITY_RANK, ALLOWED_TRANSITIONS
│   │   ├── errors/
│   │   │   ├── ApiError.js                  # Custom error class with .badRequest(400), .notFound(404), .conflict(409)
│   │   │   └── errorHandler.js              # Central Express error middleware (ApiError, ZodError, CastError, E11000)
│   │   ├── middleware/
│   │   │   ├── asyncHandler.js              # Promise rejection wrapper forwarding to next(err)
│   │   │   ├── ensureDbConnected.js         # Guarantees DB readiness per request in serverless environments
│   │   │   └── validate.js                  # Generic Zod validation middleware for params, query, and body
│   │   ├── models/
│   │   │   ├── Counter.model.js             # Atomic sequence counter ({ _id: 'taskId', seq }) -> TSK-0001
│   │   │   ├── Employee.model.js            # Employee schema, unique indexes, activeTaskCount (0..3)
│   │   │   └── Task.model.js                # Task schema, assignee ref + assigneeSnapshot, priorityRank (1..4)
│   │   ├── utils/
│   │   │   ├── date.utils.js                # UTC YYYY-MM-DD parsing, getUtcToday(), computeIsOverdue(), buildOverdueMongoCondition()
│   │   │   ├── csv.utils.js                 # RFC 4180 escaping, formula-injection guard, streaming CSV row formatter
│   │   │   └── regex.utils.js               # escapeRegex() for ReDoS-safe search queries
│   │   ├── validators/
│   │   │   ├── employee.validator.js        # Create/update/list Zod schemas (leave window conditional rules)
│   │   │   └── task.validator.js            # Create/update/status/list Zod schemas (forbids status & completedDate on CRUD)
│   │   ├── services/
│   │   │   ├── employee.service.js          # Employee CRUD, email normalization, snapshot propagation, delete guard
│   │   │   ├── taskQuery.builder.js         # Shared buildTaskFilterQuery() & buildTaskSortSpec() for List + CSV
│   │   │   ├── task.service.js              # Task CRUD, atomic capacity $inc, leave check, status machine, CSV cursor
│   │   │   └── dashboard.service.js         # Server-side $facet counts & employee workload aggregation
│   │   ├── controllers/
│   │   │   ├── employee.controller.js       # HTTP handlers for /api/employees
│   │   │   ├── task.controller.js           # HTTP handlers for /api/tasks, /:id/status, and /export.csv
│   │   │   └── dashboard.controller.js      # HTTP handler for /api/dashboard
│   │   ├── routes/
│   │   │   ├── index.js                     # Mounts /employees, /tasks, /dashboard, /health
│   │   │   ├── employee.routes.js           # REST endpoints for employees
│   │   │   ├── task.routes.js               # REST endpoints for tasks (/export.csv registered BEFORE /:id)
│   │   │   └── dashboard.routes.js          # GET /api/dashboard
│   │   ├── app.js                           # Express app factory (no network listen)
│   │   └── server.js                        # Local server bootstrapper
│   ├── tests/                               # Vitest + Supertest + mongodb-memory-server integration & concurrency specs
│   ├── .env.example                         # Documented backend environment variables
│   ├── vercel.json                          # Rewrites all /api/* traffic to api/index.js
│   └── package.json
├── client/                                  # Frontend Vite + React SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.jsx                      # QueryClientProvider, ToastProvider, ThemeProvider, RouterProvider
│   │   │   ├── queryClient.js               # TanStack Query defaults (staleTime, retry policy, global mutation error hook)
│   │   │   └── router.jsx                   # Multi-route tree: /, /employees, /employees/new, /employees/:id, /employees/:id/edit, /tasks, /tasks/new, /tasks/:id, /tasks/:id/edit
│   │   ├── styles/
│   │   │   ├── reset.css                    # Modern CSS reset
│   │   │   ├── tokens.css                   # Apple HIG design tokens (colors, vibrancy, radii, typography, dark mode)
│   │   │   └── global.css                   # Base typography, focus-visible rings, smooth theme transitions
│   │   ├── lib/
│   │   │   ├── apiClient.js                 # Fetch/Axios wrapper normalizing ApiError payloads into typed ClientApiError
│   │   │   ├── date.js                      # UTC-safe YYYY-MM-DD display formatting & client overdue helper
│   │   │   └── queryString.js               # Deterministic URLSearchParams serializer (strips empty/default params)
│   │   ├── hooks/
│   │   │   ├── useUrlFilters.js             # Generic URL query-state hook backed by useSearchParams + Zod
│   │   │   ├── useDebouncedValue.js         # Smooth 300ms search input debouncing before URL commit
│   │   │   └── useTheme.js                  # System + persisted light/dark mode controller
│   │   ├── components/
│   │   │   ├── layout/                      # AppShell, Sidebar, MobileTabBar, PageHeader (+ *.module.css)
│   │   │   └── ui/                          # Button, Input, Select, DateField, Badge, StatusSelect, Card, DataTable, Pagination, ConfirmDialog, Skeleton, EmptyState, Toast, WorkloadRing (+ *.module.css)
│   │   └── features/
│   │       ├── dashboard/
│   │       │   ├── api/                     # getDashboardSummary() + useDashboardQuery()
│   │       │   ├── components/              # StatBentoGrid, TaskBreakdownCard, EmployeeWorkloadTable
│   │       │   └── pages/                   # DashboardPage.jsx
│   │       ├── employees/
│   │       │   ├── api/                     # employeeKeys, CRUD query/mutation hooks
│   │       │   ├── schemas/                 # employeeForm.schema.js + employeeFilter.schema.js
│   │       │   ├── components/              # EmployeeFilterBar, EmployeeTable, EmployeeForm, LeaveWindowFields, EmployeeProfileHero
│   │       │   └── pages/                   # EmployeeListPage, EmployeeFormPage (Add/Edit), EmployeeDetailPage
│   │       └── tasks/
│   │           ├── api/                     # taskKeys, CRUD + status mutation hooks, exportTasksCsvUrl()
│   │           ├── constants/               # ALLOWED_NEXT_STATUSES, PRIORITY_META, STATUS_META
│   │           ├── schemas/                 # taskForm.schema.js + taskFilter.schema.js
│   │           ├── components/              # TaskFilterBar, TaskTable, TaskStatusDropdown, TaskForm, OverdueBadge, TaskDetailTimeline
│   │           └── pages/                   # TaskListPage, TaskFormPage (Add/Edit), TaskDetailPage
│   ├── .env.example                         # VITE_API_BASE_URL=http://localhost:5000/api
│   ├── vercel.json                          # SPA fallback rewrite: /(.*) -> /index.html
│   └── package.json
└── README.md                                # Setup, env vars, API reference, schema diagram, and 6 architecture answers
```

### Structure Rationale

- **Dual `server/` and `client/` roots:** Directly satisfies independent two-URL Vercel deployment (`client/vercel.json` static SPA + `server/vercel.json` serverless API) while keeping local setup clear (`npm install` and `npm run dev` in each package or via root workspace scripts).
- **Strict layer folders in `server/src/`:** Separating `routes/`, `middleware/`, `validators/`, `controllers/`, `services/`, and `models/` prevents controller bloat and keeps business-rule enforcement unit- and integration-testable without mocking HTTP objects.
- **Feature-sliced `client/src/features/` + shared `components/ui/`:** Co-locates Employee, Task, and Dashboard queries, forms, and screens by domain while guaranteeing reusable UI primitives (`DataTable`, `Pagination`, `Badge`, `StatusSelect`, `ConfirmDialog`) across both Employee and Task modules — directly addressing the assignment's componentization requirement.
- **Isolated `server/scripts/seed.js`:** Keeps optional demo seeding completely outside the Express and React runtime dependency graph, avoiding any penalty for hardcoded runtime mock data.

## Architectural Patterns

### Pattern 1: Five-Layer Backend Pipeline & Centralized `ApiError` Contract

**What:** Every HTTP request traverses `Route -> Zod Validate Middleware -> Thin Controller -> Domain Service -> Mongoose Model`. Any failure along the pipeline throws or forwards into a single `errorHandler` middleware that emits a consistent JSON error envelope with deterministic HTTP status codes (`400`, `404`, `409`, `500`).

**When to use:** All REST endpoints across `/api/employees`, `/api/tasks`, and `/api/dashboard`.

**Trade-offs:**
- *Pros:* Business rules cannot be bypassed by alternate controllers; frontend toast and form error handlers parse one predictable error shape (`{ success: false, error: { code, message, details } }`); route ordering bugs (such as `/api/tasks/export.csv` vs `/api/tasks/:id`) are isolated to `routes/`.
- *Cons:* Slightly more files than writing Mongoose calls inline inside Express route callbacks — an intentional trade-off explicitly rewarded by the grading rubric.

**HTTP Status & Error Mapping Contract:**

| Scenario | HTTP Status | Error Code | Source Layer |
|----------|-------------|------------|--------------|
| Malformed payload, invalid query param, invalid Mongo ObjectId (`CastError`) | `400 Bad Request` | `VALIDATION_ERROR` | `validate.js` / `errorHandler.js` |
| Broken domain rule (`dueDate < startDate`, inactive/on-leave assignment, max 3 active tasks, invalid status transition, editing `Completed`/`Cancelled` task, passing `status` or `completedDate` on CRUD) | `400 Bad Request` | `BUSINESS_RULE_VIOLATION` | `*.service.js` |
| Employee, Task, or API route does not exist | `404 Not Found` | `NOT_FOUND` | `*.service.js` / `app.js` |
| Duplicate `employeeId` or normalized `email` (pre-check or concurrent `E11000`), or deleting an employee who still holds `Todo` / `In Progress` tasks | `409 Conflict` | `CONFLICT` | `employee.service.js` / `errorHandler.js` |

**Example:**

```javascript
// server/src/errors/ApiError.js
export class ApiError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
  static badRequest(message, details = null) {
    return new ApiError(400, 'BUSINESS_RULE_VIOLATION', message, details);
  }
  static validation(message, details = null) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }
  static notFound(message) {
    return new ApiError(404, 'NOT_FOUND', message);
  }
  static conflict(message, details = null) {
    return new ApiError(409, 'CONFLICT', message, details);
  }
}

// server/src/errors/errorHandler.js
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: `Invalid identifier for ${err.path}` },
    });
  }
  if (err.code === 11000) {
    const dupField = Object.keys(err.keyPattern || {})[0] || 'field';
    const label = dupField === 'employeeId' ? 'Employee ID' : dupField === 'email' ? 'Email' : dupField;
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: `An employee with this ${label} already exists.` },
    });
  }
  console.error('[UnhandledError]', err);
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' },
  });
}
```

---

### Pattern 2: Hybrid Reference + Embedded Snapshot MongoDB Schema Design

**What:** Three Mongoose collections (`counters`, `employees`, `tasks`) combine relational `ObjectId` references (`Task.assignee -> Employee._id`) with an embedded `Task.assigneeSnapshot` subdocument, a numeric `Task.priorityRank` (`1..4`), and an authoritative `Employee.activeTaskCount` (`0..3`) counter.

**When to use:** Whenever historical child records (`Task`) must survive parent deletion (`Employee`) with rich display/search metadata, and server-side sorting requires non-alphabetical enum ordering (`Critical > High > Medium > Low`).

**Trade-offs:**
- *Pros:*
  1. **Zero data loss on employee deletion:** When an employee with `0` active tasks is deleted, historical `Completed` and `Cancelled` tasks retain `{ employeeId, fullName, email, department, role }` in `assigneeSnapshot` without requiring soft-delete flags that would block re-registering an email or Employee ID later.
  2. **Single-collection search & CSV speed:** `GET /api/tasks?search=rahul` queries `assigneeSnapshot.fullName` directly on `tasks` without an expensive `$lookup` join across collections.
  3. **Indexed importance sort:** `priorityRank` (`Low=1, Medium=2, High=3, Critical=4`) allows native B-tree index sorting `{ priorityRank: -1 }` instead of computing `$switch` expressions per request.
- *Cons:* Updating an existing employee's `fullName`, `email`, `department`, `role`, or `employeeId` requires a one-line `Task.updateMany({ assignee: employee._id }, { $set: { assigneeSnapshot } })` fan-out in `employee.service.js` (trivial because an employee holds tens of tasks, not millions).

**Schema Specifications:**

```javascript
// 1. Counter Model — server/src/models/Counter.model.js
const counterSchema = new Schema({
  _id: { type: String, required: true }, // e.g., 'taskId'
  seq: { type: Number, default: 0 },
}, { versionKey: false });

counterSchema.statics.nextTaskId = async function nextTaskId() {
  const doc = await this.findOneAndUpdate(
    { _id: 'taskId' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `TSK-${String(doc.seq).padStart(4, '0')}`;
};

// 2. Employee Model — server/src/models/Employee.model.js
const employeeSchema = new Schema({
  employeeId:      { type: String, required: true, unique: true, trim: true },
  fullName:        { type: String, required: true, trim: true },
  email:           { type: String, required: true, unique: true, trim: true, lowercase: true },
  phone:           { type: String, required: true, trim: true },
  department:      { type: String, required: true, enum: ['Development', 'Design', 'QA', 'HR', 'Sales'] },
  role:            { type: String, required: true, trim: true },
  joiningDate:     { type: Date, required: true }, // Normalized UTC 00:00:00.000Z
  status:          { type: String, required: true, enum: ['Active', 'Inactive', 'On Leave'], default: 'Active' },
  skills:          { type: [String], default: [] },
  leaveStart:      { type: Date, default: null },  // Non-null ONLY when status === 'On Leave'
  leaveEnd:        { type: Date, default: null },  // Non-null ONLY when status === 'On Leave'
  activeTaskCount: { type: Number, required: true, default: 0, min: 0, max: 3 },
}, { timestamps: true });

employeeSchema.index({ department: 1, status: 1 });
employeeSchema.index({ fullName: 1 });
employeeSchema.index({ activeTaskCount: -1, fullName: 1 });

// 3. Task Model — server/src/models/Task.model.js
const assigneeSnapshotSchema = new Schema({
  employeeId: { type: String, required: true },
  fullName:   { type: String, required: true },
  email:      { type: String, required: true },
  department: { type: String, required: true },
  role:       { type: String, required: true },
}, { _id: false });

const PRIORITY_RANK_MAP = { Low: 1, Medium: 2, High: 3, Critical: 4 };

const taskSchema = new Schema({
  taskId:           { type: String, required: true, unique: true, immutable: true },
  title:            { type: String, required: true, trim: true },
  description:      { type: String, trim: true, default: '' },
  assignee:         { type: Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
  assigneeSnapshot: { type: assigneeSnapshotSchema, required: true },
  department:       { type: String, required: true, enum: ['Development', 'Design', 'QA', 'HR', 'Sales'] },
  priority:         { type: String, required: true, enum: ['Low', 'Medium', 'High', 'Critical'] },
  priorityRank:     { type: Number, required: true, min: 1, max: 4 },
  status:           { type: String, required: true, enum: ['Todo', 'In Progress', 'Completed', 'Cancelled'], default: 'Todo' },
  startDate:        { type: Date, required: true }, // Normalized UTC 00:00:00.000Z
  dueDate:          { type: Date, required: true }, // Normalized UTC 00:00:00.000Z
  completedDate:    { type: Date, default: null },  // Server-authoritative; null until status === 'Completed'
}, { timestamps: true });

taskSchema.pre('validate', function syncPriorityRank(next) {
  if (this.priority && PRIORITY_RANK_MAP[this.priority]) {
    this.priorityRank = PRIORITY_RANK_MAP[this.priority];
  }
  next();
});

taskSchema.index({ status: 1, dueDate: 1 });
taskSchema.index({ department: 1, priorityRank: -1, status: 1 });
taskSchema.index({ priorityRank: -1, createdAt: -1 });
taskSchema.index({ createdAt: -1 });
taskSchema.index({ 'assigneeSnapshot.fullName': 1 });
```

---

### Pattern 3: Standalone-Safe Atomic Concurrency & State Machine Guards

**What:** Enforces the 3-active-task capacity cap, Active / On-Leave eligibility check, status state machine, and employee deletion lock using **single-document atomic conditional `findOneAndUpdate` / `findOneAndDelete` predicates** paired with compensating rollback — requiring zero replica-set multi-document transactions.

**When to use:** Mandatory for this project because local evaluation runs against standalone `mongod` (`mongodb://127.0.0.1:27017/roots_ems`), where `session.withTransaction()` fails with `IllegalOperation: Transaction numbers are only allowed on a replica set member or mongos`, yet concurrent requests assigning a 4th task (README Question 6) must still be deterministically blocked.

**Trade-offs:**
- *Pros:* Works identically on local standalone `mongod`, `mongodb-memory-server`, and MongoDB Atlas; MongoDB's document-level write lock serializes concurrent capacity claims on the same `Employee` document with sub-millisecond latency.
- *Cons:* Requires explicit compensating `$inc: { activeTaskCount: -1 }` if `Task.create()` fails after capacity is claimed, plus a reconciliation helper (`reconcileEmployeeCapacity`) used by seed/maintenance scripts.

**Core Concurrency & State Machine Invariants:**

1. **Atomic Eligibility + Capacity Claim (`claimEmployeeCapacity`):**
   Encodes *all three* assignment rules inside a single atomic filter:
   - `Inactive` employee -> never matches -> always rejected (`400`).
   - `On Leave` employee -> matches *only* if `startDate < leaveStart` OR `startDate > leaveEnd` (rejecting `leaveStart <= startDate <= leaveEnd`, both dates inclusive, `400`).
   - `Active` (or eligible `On Leave`) employee -> matches *only* if `activeTaskCount < 3` (`400` if full).
2. **Atomic Task Status Transition (`PUT /api/tasks/:id/status`):**
   Uses `{ _id: taskId, status: currentStatus }` in `Task.findOneAndUpdate()` so two simultaneous `PUT /status` requests cannot both transition a task from `In Progress` to terminal states and double-decrement `activeTaskCount`.
3. **Atomic Employee Deletion Guard (`DELETE /api/employees/:id`):**
   Checks live `Task.exists({ assignee: id, status: { $in: ['Todo', 'In Progress'] } })` and executes `Employee.findOneAndDelete({ _id: id, activeTaskCount: 0 })` before setting `assignee: null` on historical tasks (`assigneeSnapshot` remains intact). Because `claimEmployeeCapacity` and `findOneAndDelete` contend on the same `Employee` document lock, a concurrent task assignment cannot race with employee deletion.

**Example:**

```javascript
// server/src/services/task.service.js (excerpt)
const ALLOWED_TRANSITIONS = {
  'Todo': ['In Progress', 'Cancelled'],
  'In Progress': ['Completed', 'Cancelled'],
  'Completed': [],
  'Cancelled': [],
};

async function claimEmployeeCapacity(employeeId, taskStartDateUtc) {
  const claimed = await Employee.findOneAndUpdate(
    {
      _id: employeeId,
      activeTaskCount: { $lt: 3 },
      $or: [
        { status: 'Active' },
        {
          status: 'On Leave',
          $or: [
            { leaveStart: { $gt: taskStartDateUtc } },
            { leaveEnd: { $lt: taskStartDateUtc } },
          ],
        },
      ],
    },
    { $inc: { activeTaskCount: 1 } },
    { new: true }
  );

  if (claimed) return claimed;

  // Diagnose exact reason for rejection to return friendly, specific error message
  const emp = await Employee.findById(employeeId).lean();
  if (!emp) throw ApiError.notFound('Assigned employee not found.');
  if (emp.status === 'Inactive') {
    throw ApiError.badRequest('Cannot assign tasks to an Inactive employee.');
  }
  if (
    emp.status === 'On Leave' &&
    taskStartDateUtc >= emp.leaveStart &&
    taskStartDateUtc <= emp.leaveEnd
  ) {
    throw ApiError.badRequest(
      `Cannot assign task: ${emp.fullName} is on leave from ${formatUtcYmd(emp.leaveStart)} to ${formatUtcYmd(emp.leaveEnd)} (inclusive).`
    );
  }
  throw ApiError.badRequest('Employee already has 3 active tasks. Please choose another employee.');
}

export async function createTask(payload) {
  const startDate = parseUtcDateOnly(payload.startDate);
  const dueDate = parseUtcDateOnly(payload.dueDate);
  if (dueDate < startDate) {
    throw ApiError.badRequest('Due Date cannot be earlier than Start Date.');
  }

  const employee = await claimEmployeeCapacity(payload.assignee, startDate);
  try {
    const taskId = await Counter.nextTaskId();
    const task = await Task.create({
      taskId,
      title: payload.title,
      description: payload.description ?? '',
      assignee: employee._id,
      assigneeSnapshot: toAssigneeSnapshot(employee),
      department: payload.department,
      priority: payload.priority,
      priorityRank: PRIORITY_RANK_MAP[payload.priority],
      status: 'Todo',        // Forced server-side
      startDate,
      dueDate,
      completedDate: null,   // Forced server-side
    });
    return serializeTask(task.toObject());
  } catch (err) {
    await Employee.updateOne(
      { _id: employee._id, activeTaskCount: { $gt: 0 } },
      { $inc: { activeTaskCount: -1 } }
    );
    throw err;
  }
}

export async function updateTaskStatus(id, nextStatus) {
  const existing = await Task.findById(id).lean();
  if (!existing) throw ApiError.notFound('Task not found.');

  const allowed = ALLOWED_TRANSITIONS[existing.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw ApiError.badRequest(
      `Invalid status transition from "${existing.status}" to "${nextStatus}".`
    );
  }

  const isTerminal = nextStatus === 'Completed' || nextStatus === 'Cancelled';
  const updateFields = {
    status: nextStatus,
    ...(nextStatus === 'Completed' ? { completedDate: new Date() } : {}),
  };

  const updated = await Task.findOneAndUpdate(
    { _id: id, status: existing.status }, // Atomic compare-and-swap on prior status
    { $set: updateFields },
    { new: true }
  ).lean();

  if (!updated) {
    throw ApiError.conflict('Task status was modified concurrently. Please refresh and try again.');
  }

  if (isTerminal && existing.assignee) {
    await Employee.updateOne(
      { _id: existing.assignee, activeTaskCount: { $gt: 0 } },
      { $inc: { activeTaskCount: -1 } }
    );
  }

  return serializeTask(updated);
}
```

---

### Pattern 4: Shared Server Filter Builder, Streaming CSV & UTC Overdue Engine

**What:** Centralizes calendar-date math in `date.utils.js` (UTC midnight `YYYY-MM-DDT00:00:00.000Z`) and filter/sort query compilation in `taskQuery.builder.js`, consumed identically by `GET /api/tasks`, `GET /api/tasks/:id`, `GET /api/dashboard`, and `GET /api/tasks/export.csv`.

**When to use:** Every endpoint that reads, aggregates, or exports tasks.

**Trade-offs:**
- *Pros:* Eliminates drift between table rows, detail badges, dashboard KPI counts, and exported CSV rows; prevents IST (`+05:30`) vs UTC (`+00:00`) off-by-one day bugs between local laptops and Vercel serverless nodes; streaming Mongoose `.cursor()` exports thousands of matching rows without buffering the full result set in Node heap memory.
- *Cons:* Requires strict discipline that every date-only field (`joiningDate`, `leaveStart`, `leaveEnd`, `startDate`, `dueDate`) enters the system as `YYYY-MM-DD` and is parsed via `parseUtcDateOnly()`.

**Example:**

```javascript
// server/src/utils/date.utils.js
export const OPEN_TASK_STATUSES = ['Todo', 'In Progress'];

export function parseUtcDateOnly(ymdString) {
  // Validated upstream as /^\d{4}-\d{2}-\d{2}$/
  const [y, m, d] = ymdString.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw ApiError.validation(`Invalid calendar date: ${ymdString}`);
  }
  return dt;
}

export function getUtcToday(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function computeIsOverdue(task, todayUtc = getUtcToday()) {
  return OPEN_TASK_STATUSES.includes(task.status) && new Date(task.dueDate) < todayUtc;
}

export function buildOverdueMongoCondition(todayUtc = getUtcToday()) {
  return {
    status: { $in: OPEN_TASK_STATUSES },
    dueDate: { $lt: todayUtc },
  };
}

// server/src/services/taskQuery.builder.js
export function buildTaskFilterQuery(params, todayUtc = getUtcToday()) {
  const filter = {};

  if (params.search) {
    const safeRegex = new RegExp(escapeRegex(params.search.trim()), 'i');
    filter.$or = [
      { title: safeRegex },
      { 'assigneeSnapshot.fullName': safeRegex },
      { taskId: safeRegex },
    ];
  }
  if (params.department) filter.department = params.department;
  if (params.priority) filter.priority = params.priority;
  if (params.status) filter.status = params.status;
  if (params.assignee) filter.assignee = params.assignee;

  if (params.dueFrom || params.dueTo) {
    filter.dueDate = {};
    if (params.dueFrom) filter.dueDate.$gte = parseUtcDateOnly(params.dueFrom);
    if (params.dueTo) filter.dueDate.$lte = parseUtcDateOnly(params.dueTo);
  }

  if (params.overdue === 'true' || params.overdue === true) {
    Object.assign(filter, {
      status: params.status
        ? (OPEN_TASK_STATUSES.includes(params.status) ? params.status : '__NONE__')
        : { $in: OPEN_TASK_STATUSES },
      dueDate: { ...(filter.dueDate || {}), $lt: todayUtc },
    });
  }

  return filter;
}

export function buildTaskSortSpec(sortBy = 'createdAt', sortOrder = 'desc') {
  const dir = sortOrder === 'asc' ? 1 : -1;
  switch (sortBy) {
    case 'priority':  return { priorityRank: dir, createdAt: -1, _id: 1 };
    case 'dueDate':   return { dueDate: dir, priorityRank: -1, _id: 1 };
    case 'title':     return { title: dir, _id: 1 };
    case 'createdAt':
    default:          return { createdAt: dir, _id: 1 };
  }
}
```

---

### Pattern 5: Feature-Sliced Frontend, Tokenized CSS Modules & URL-Driven Query State

**What:** The URL query string is the *single source of truth* for list state (`search`, `department`, `priority`, `status`, `dueFrom`, `dueTo`, `sortBy`, `sortOrder`, `page`, `limit`). `useUrlFilters` parses `useSearchParams()` through a Zod schema with safe fallbacks, automatically resets `page` to `1` on filter changes, and passes the normalized filter object straight into TanStack Query's `queryKey` and the CSV export link builder. All styling uses CSS Modules (`*.module.css`) consuming Apple HIG tokens (`tokens.css`).

**When to use:** Both Employee List (`/employees?...`) and Task List (`/tasks?...`) views.

**Trade-offs:**
- *Pros:* Refreshing the browser, sharing a deep link (`/tasks?status=In%20Progress&priority=High&page=2`), or clicking Back/Forward restores the exact server-filtered view with zero `useEffect` synchronization loops; TanStack Query's `placeholderData: keepPreviousData` keeps table geometry stable while fetching the next page; CSV Export passes the exact same serialized filter object (minus `page`/`limit`) so all matching records across all pages download.
- *Cons:* Controlled search inputs need a lightweight local draft value paired with `useDebouncedValue` (300ms) calling `setFilter('search', value, { replace: true })` so typing feels instantaneous at 60fps without pushing 20 history entries.

**Example:**

```jsx
// client/src/hooks/useUrlFilters.js
import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useUrlFilters(zodSchema, defaults) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const raw = Object.fromEntries(searchParams.entries());
    return zodSchema.parse(raw); // Each field uses .catch(defaultVal) in schema
  }, [searchParams, zodSchema]);

  const updateFilters = useCallback(
    (patch, options = { replace: false }) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const isFilterOrSortChange = Object.keys(patch).some((k) => k !== 'page');
        if (isFilterOrSortChange && !('page' in patch)) {
          next.delete('page'); // Reset to page 1 when narrowing/sorting
        }
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined || value === null || value === '' || value === defaults[key]) {
            next.delete(key);
          } else {
            next.set(key, String(value));
          }
        }
        return next;
      }, options);
    },
    [setSearchParams, defaults]
  );

  const resetFilters = useCallback(() => setSearchParams({}, { replace: false }), [setSearchParams]);

  return { filters, updateFilters, resetFilters };
}

// client/src/features/tasks/api/useTasksQuery.js
import { useQuery, keepPreviousData } from '@tanstack/react-query';

export const taskKeys = {
  all: ['tasks'],
  lists: () => [...taskKeys.all, 'list'],
  list: (filters) => [...taskKeys.lists(), filters],
  details: () => [...taskKeys.all, 'detail'],
  detail: (id) => [...taskKeys.details(), id],
};

export function useTasksQuery(filters) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => fetchTasks(filters),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}
```

## Data Flow

### Request Flow

```
1. Filtered List & CSV Export Flow (Shared Query Engine)
────────────────────────────────────────────────────────
Browser URL (?status=In%20Progress&priority=High&page=2)
    │
    ├──► [TaskListPage] ──► useUrlFilters() ──► useTasksQuery(filters)
    │                                                │
    │         GET /api/tasks?status=In%20Progress&priority=High&page=2
    │                                                ▼
    │         [task.routes] ──► [validate(taskListQuerySchema)] ──► [task.controller.list]
    │                                                                      │
    │                                 ┌────────────────────────────────────┘
    │                                 ▼
    │                    buildTaskFilterQuery(query, todayUtc)
    │                    buildTaskSortSpec(sortBy, sortOrder)
    │                                 │
    │         ┌───────────────────────┴────────────────────────┐
    │         ▼ (Paginated JSON)                               ▼ (Export CSV Button: omits page/limit)
    │   Task.find(filter).sort(sort)                     GET /api/tasks/export.csv?status=...&priority=...
    │       .skip().limit().lean()                             │
    │   + computeIsOverdue(doc, todayUtc)                Task.find(filter).sort(sort).lean().cursor()
    │         │                                          + computeIsOverdue(doc, todayUtc)
    │         ▼                                                │
    │   { data: TaskDTO[], meta: Pagination }                  ▼
    └─────────┴───────────────────────────────────────► Streamed text/csv attachment (all matching rows)


2. Mutation & Cross-Feature Cache Invalidation Flow
───────────────────────────────────────────────────
[TaskStatusDropdown] (renders ONLY ALLOWED_NEXT_STATUSES[task.status])
    │
    ▼  PUT /api/tasks/:id/status { status: "Completed" }
[validate(statusSchema)] ──► [task.service.updateTaskStatus]
                                   │
                                   ├──► Task.findOneAndUpdate({ _id, status: "In Progress" },
                                   │      { $set: { status: "Completed", completedDate: now } })
                                   └──► Employee.updateOne({ _id: assignee, activeTaskCount: { $gt: 0 } },
                                          { $inc: { activeTaskCount: -1 } })
                                   │
                                   ▼
[TanStack useMutation onSuccess]
    ├──► invalidateQueries(['tasks'])      (refreshes list, detail, completedDate, overdue state)
    ├──► invalidateQueries(['employees'])  (refreshes employee activeTaskCount badge)
    ├──► invalidateQueries(['dashboard'])  (refreshes KPI cards & workload rings)
    └──► toast.success('Task marked as Completed')
```

### State Management

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FRONTEND STATE PARTITIONING                         │
├───────────────────────┬─────────────────────────────────────────────────┤
│ 1. URL Search Params  │ Search query, department/priority/status/date   │
│    (React Router)     │ filters, sortBy, sortOrder, page, limit.        │
├───────────────────────┼─────────────────────────────────────────────────┤
│ 2. Server Cache State │ Employees, Tasks, Task/Employee Details, and    │
│    (TanStack Query)   │ Dashboard metrics keyed by normalized params.   │
├───────────────────────┼─────────────────────────────────────────────────┤
│ 3. Form State         │ Add/Edit Employee & Task drafts, conditional    │
│    (React Hook Form)  │ On-Leave date fields, inline field errors.      │
├───────────────────────┼─────────────────────────────────────────────────┤
│ 4. Ephemeral UI State │ Toast queue, Delete ConfirmDialog open target,  │
│    (React Context)    │ mobile drawer toggle, light/dark theme token.   │
└───────────────────────┴─────────────────────────────────────────────────┘
```

### Key Data Flows

1. **Task Assignment & Reassignment Flow:**
   - User submits Add/Edit Task form (status and completedDate inputs do not exist in the form and are strictly rejected by backend Zod schemas).
   - Backend validates `dueDate >= startDate` in UTC date-only format, then runs `claimEmployeeCapacity(assigneeId, startDateUtc)`.
   - On task **Edit**: backend first rejects if current status is `Completed` or `Cancelled`. If `assignee` is unchanged but `startDate` changed, backend re-verifies the assignee is not `Inactive` and the new `startDate` does not fall inside `[leaveStart, leaveEnd]`. If `assignee` changed, backend atomically claims a slot on the new employee *before* updating the task and releasing (`$inc: -1`) the previous employee's slot.
2. **Employee Lifecycle, Snapshot Sync & Safe Deletion Flow:**
   - Creating or updating an employee normalizes `email = email.trim().toLowerCase()`. If `status !== 'On Leave'`, `leaveStart` and `leaveEnd` are coerced to `null`; if `status === 'On Leave'`, both dates are required and `leaveEnd >= leaveStart`.
   - Updating an employee's identity/org attributes (`employeeId`, `fullName`, `email`, `department`, `role`) propagates updated `assigneeSnapshot` fields via `Task.updateMany({ assignee: employee._id }, ...)`.
   - Deleting an employee checks live active tasks (`Todo` / `In Progress`) and executes `Employee.findOneAndDelete({ _id, activeTaskCount: 0 })`. If blocked, returns `409` with a clear message (`"Cannot delete Rahul Sharma while holding 2 active tasks. Reassign, complete, or cancel active tasks first."`). If allowed, nulls `Task.assignee` on historical `Completed`/`Cancelled` tasks while leaving `Task.assigneeSnapshot` untouched so Task List, Task View, and CSV Export still display `"Rahul Sharma (EMP-001 • Deleted)"`.
3. **Dashboard Server Aggregation Flow (`GET /api/dashboard`):**
   - Executes two parallel Mongoose aggregations (`Promise.all`):
     1. `Employee.aggregate([{ $facet: { byStatus: [...], workload: [...] } }])` computing `total`, `active`, `inactive`, `onLeave`, and the employee workload list (`employeeId`, `fullName`, `department`, `role`, `status`, `activeTaskCount`).
     2. `Task.aggregate([{ $facet: { byStatus: [...], overdue: [{ $match: buildOverdueMongoCondition(todayUtc) }, { $count: 'count' }] } }])` computing `total`, `todo`, `inProgress`, `completed`, `cancelled`, and `overdue`.
   - Zero counts or workload calculations occur in React.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0–1k users (Target Scope)** | Single Express service + MongoDB collection indexes + Mongoose `.cursor()` CSV streaming + TanStack Query caching handles sub-30ms queries effortlessly on local `mongod` and Vercel/Atlas free/shared tiers. |
| **1k–100k tasks** | Replace unanchored regex search (`/term/i`) with MongoDB Atlas Search or compound `$text` index on `title` and `assigneeSnapshot.fullName`; switch offset `.skip()` pagination on deep pages (`page > 200`) to keyset cursor pagination (`createdAt` + `_id`). |
| **100k+ tasks** | Offload large CSV exports (`>50k` rows) to an async background worker writing to object storage (S3/R2) with signed download URLs to avoid serverless 10s–60s HTTP execution timeouts. |

### Scaling Priorities

1. **First bottleneck — Serverless MongoDB Connection Churn:** In Vercel serverless functions, creating a new `mongoose.connect()` per invocation exhausts Atlas connection limits. Mitigate from Day 1 by caching the connection promise on `globalThis.__mongooseConn` with `maxPoolSize: 10`.
2. **Second bottleneck — Unbounded CSV Memory Allocation:** Loading all filtered tasks via `await Task.find(filter)` into an array spikes Node heap memory. Mitigate from Day 1 by streaming `Task.find(filter).sort(sort).lean().cursor()` chunk-by-chunk directly into `res.write()`.

## Anti-Patterns

### Anti-Pattern 1: Read-Then-Write (`countDocuments` -> `Task.create`) for the 3-Task Capacity Rule

**What people do:** Run `const count = await Task.countDocuments({ assignee, status: { $in: ['Todo', 'In Progress'] } }); if (count >= 3) throw error; await Task.create(...);`.
**Why it's wrong:** Under two simultaneous HTTP requests when `count === 2` (README Question 6), both requests read `2`, both pass the `if` guard, and both insert a task — leaving the employee with **4 active tasks** and violating the core capacity invariant.
**Do this instead:** Gate task creation and reassignment with a single-document atomic conditional increment `Employee.findOneAndUpdate({ _id, activeTaskCount: { $lt: 3 }, ...eligibility }, { $inc: { activeTaskCount: 1 } })` and run compensating `$inc: -1` if `Task.create()` fails.

### Anti-Pattern 2: Allowing `status` or `completedDate` Through General Create/Edit Endpoints

**What people do:** Share one permissive Mongoose `findByIdAndUpdate(id, req.body)` handler for `PUT /api/tasks/:id`, relying on the React form simply omitting the `status` field.
**Why it's wrong:** Directly penalized in the assignment rubric (*"status editable through the normal update API"* and *"Completed Date never taken from the frontend"*). Any API client (`curl`/Postman/automated grader) sending `{ "status": "Completed", "completedDate": "1999-01-01" }` to `PUT /api/tasks/:id` would bypass the state machine and forge completion timestamps.
**Do this instead:** Explicitly reject or strip `status` and `completedDate` in `createTaskSchema` and `updateTaskSchema` (returning `400` if supplied), lock edits when `task.status` is `Completed` or `Cancelled`, and mutate `status` + server-generated `completedDate` exclusively inside `PUT /api/tasks/:id/status`.

### Anti-Pattern 3: Timezone-Naive `new Date()` Comparisons for Leave Windows and Overdue Logic

**What people do:** Compare `new Date()` (including current hours/minutes and server local timezone offset) directly against `dueDate` or `leaveStart`/`leaveEnd`.
**Why it's wrong:** A task due *today* (`2026-10-20T00:00:00.000Z`) becomes falsely "Overdue" at `00:01 UTC` (`05:31 AM IST`) on its own due date! Worse, browser local date pickers vs UTC Vercel servers shift dates by `-1` or `+1` day around midnight.
**Do this instead:** Normalize all calendar dates (`joiningDate`, `leaveStart`, `leaveEnd`, `startDate`, `dueDate`) to UTC midnight (`YYYY-MM-DDT00:00:00.000Z`) and compare against `getUtcToday()` (`00:00:00.000Z`), so `today > dueDate` is strictly `dueDate < todayUtc` everywhere.

### Anti-Pattern 4: Separate Filter Implementations for Task List vs CSV Export (or Client-Side CSV)

**What people do:** Export CSV in React from `tasksQuery.data.items` (which only contains the 10 rows of the current page), or copy-paste a second query builder for `/api/tasks/export.csv` that forgets date-range or employee-name search clauses.
**Why it's wrong:** Explicitly prohibited by the specification (*"Export CSV downloads all tasks matching the current filters (not only the visible page)"*).
**Do this instead:** Extract `buildTaskFilterQuery()` and `buildTaskSortSpec()` into `taskQuery.builder.js` and invoke them in both `listTasks` (with `.skip/.limit`) and `exportTasksCsv` (with `.cursor()`, no pagination).

### Anti-Pattern 5: Mirroring URL Query Parameters into `useState` + `useEffect`

**What people do:** Initialize `const [status, setStatus] = useState('')`, sync URL -> state in one `useEffect`, and sync state -> URL in another `useEffect`.
**Why it's wrong:** Causes double network fetches on mount, race loops when clicking the browser Back button, and stale pagination bugs on refresh.
**Do this instead:** Derive `filters` directly from `useSearchParams()` via `useMemo` in `useUrlFilters()`, keeping `useState` only for transient debounced text input drafts.

### Anti-Pattern 6: Relying Solely on `populate('assignee')` Without `assigneeSnapshot`

**What people do:** Store only `assignee: ObjectId` on `Task` and render `task.assignee?.fullName ?? 'Deleted Employee'`.
**Why it's wrong:** Fails two requirements simultaneously: (1) *"Old tasks must still show meaningful employee details if the employee is later deleted"*, and (2) server-side search by employee name breaks or requires slow `$lookup` pipelines on every page load.
**Do this instead:** Persist `assigneeSnapshot` (`{ employeeId, fullName, email, department, role }`) on `Task` alongside `assignee: ObjectId`, synchronize it on employee profile edits, and keep it permanently intact if the employee is later deleted.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Local MongoDB (`mongod`)** | `MONGODB_URI=mongodb://127.0.0.1:27017/roots_ems` via Mongoose singleton | Standalone instance (no replica set); drives choice of single-document atomic `$inc` instead of multi-doc transactions. |
| **MongoDB Atlas** | Same `MONGODB_URI` (`mongodb+srv://...`) injected via Vercel Environment Variables | Zero code changes between local and cloud; configure Network Access + connection caching (`maxPoolSize: 10`). |
| **Vercel Serverless API (`server/`)** | `server/api/index.js` wraps `app.js` after awaiting `connectDB()`; `server/vercel.json` routes `/(.*)` to `/api/index.js` | Configure `CORS_ORIGIN` to allow both `http://localhost:5173` and deployed frontend URL. |
| **Vercel Static SPA (`client/`)** | Vite build (`dist/`) with `client/vercel.json` rewrite `{ "source": "/(.*)", "destination": "/index.html" }` | Required so refreshing deep URLs like `/tasks?status=In%20Progress&page=2` or `/employees/123/edit` does not 404 on Vercel CDN. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Express Routes ↔ Controllers** | Express middleware chain (`validate(schema)` -> `controller`) | Static paths (`/tasks/export.csv`) MUST be mounted before parameterized paths (`/tasks/:id`) in `task.routes.js`. |
| **`employee.service` ↔ `task.service`** | Mongoose models (`Employee`, `Task`) with explicit document-lock order | Always mutate/lock `Employee.activeTaskCount` first, then `Task`, so capacity claim and employee deletion (`activeTaskCount: 0`) serialize cleanly on `Employee`. |
| **`task.service` ↔ `dashboard.service`** | Shared `date.utils.js` (`getUtcToday`, `buildOverdueMongoCondition`) | Prevents any discrepancy between Dashboard "Overdue" card count and Task List "Overdue" badges. |
| **Frontend `apiClient` ↔ Toast/Forms** | Standardized `ClientApiError` preserving `status`, `code`, `message`, `details` | Mutation `onError` surfaces exact backend business-rule messages in Apple-styled toast banners and inline form alerts. |
| **`components/ui/` ↔ `features/*`** | Props + CSS Module class composition (zero domain imports inside `ui/`) | Ensures `ui/` components stay pure, reusable across Employee and Task screens, and free of inline `style={{}}` attributes. |

### Suggested Build Order (Roadmap Implications)

1. **Foundation & Shared Domain Core (`server` bootstrap + schemas + date/error utilities):**
   - Environment validation, `connectDB` singleton, `ApiError` + `errorHandler`, `date.utils` (UTC date-only & overdue helpers), and Mongoose models (`Counter`, `Employee`, `Task`) with indexes.
2. **Backend Employee & Task Services + Automated Invariant Suite:**
   - `employee.service` (CRUD, normalized email, leave rules, snapshot sync, delete guard) -> `taskQuery.builder` -> `task.service` (atomic `$inc` capacity, inclusive leave check, `PUT /:id/status` state machine, server `completedDate`, streaming CSV) -> `dashboard.service` (`$facet` aggregation) -> Vitest + Supertest + `mongodb-memory-server` tests (including `Promise.all` 4th-task concurrency race test) + standalone `npm run seed`.
3. **Frontend Foundation, Apple HIG Design System & AppShell:**
   - `tokens.css` (light/dark Apple semantic tokens), `AppShell` responsive navigation (macOS glass sidebar / tablet rail / iOS mobile tab bar), reusable `components/ui/` primitives, `apiClient`, `ToastProvider`, and `useUrlFilters` hook.
4. **Employee Management Vertical Slice & Dashboard:**
   - Employee List (URL-synced search/filter/sort/pagination), Add/Edit Employee form (conditional `On Leave` window validation + `409` duplicate feedback), creative Employee Detail view (skills, leave banner, workload ring, assigned tasks), and Server-Driven Dashboard view.
5. **Task Management Vertical Slice, Status Workflow & CSV Export:**
   - Task List (URL-synced search/filter/sort/pagination, inline `TaskStatusDropdown` restricted to valid next transitions, overdue badges, filter-aware CSV export), Add/Edit Task form (locked edit guard for terminal tasks, friendly server rule banners), and creative Task Detail view (audit timeline, assignee snapshot card surviving deletion).
6. **Deployment Packaging & Architectural Documentation:**
   - Dual `vercel.json` configs (`client/` + `server/`), `.env.example` audit, end-to-end smoke verification, and `README.md` with schema diagrams and concise answers to all 6 architecture questions.

## Sources

- Primary Specification: `Roots_MERN_Intern_Assignment.pdf` (Pages 1–4: Entity definitions, 8 backend business rules, server search/filter/sort/CSV/dashboard contracts, URL state requirement, rubric, and 6 README questions) — **HIGH confidence**
- Project Context & Constraints: `.planning/PROJECT.md` — **HIGH confidence**
- MongoDB Manual & Mongoose v8 Documentation: Atomic single-document `findOneAndUpdate` concurrency semantics, `$facet` aggregation pipelines, and `.cursor()` query streaming — **HIGH confidence**
- TanStack Query v5 & React Router v7 Documentation: URL search parameter state synchronization (`useSearchParams`) paired with `placeholderData: keepPreviousData` — **HIGH confidence**

---
*Architecture research for: Roots Employee & Task Management System*
*Researched: 2026-11-16*
