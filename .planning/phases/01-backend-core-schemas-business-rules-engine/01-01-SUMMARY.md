---
phase: 01-backend-core-schemas-business-rules-engine
plan: 01
subsystem: api
tags: [nodejs, express5, mongoose8, zod, mongodb, esm, vitest]

requires: []
provides:
  - "Node.js 24 ESM Express 5 server foundation with /api/health, CORS, Helmet, and central error handling"
  - "Cached Mongoose 8 connection helper (bufferCommands: false) compatible with local mongod, MongoMemoryServer, and Vercel serverless"
  - "UTC midnight calendar-date normalization and range utilities (parseUtcCalendarDate, formatUtcDate, isDateInRangeInclusive)"
  - "Express 5-safe Zod validation middleware storing parsed payloads on req.validated without mutating read-only req.query"
  - "Counter, Employee, and Task Mongoose schemas with unique indexes, 5-department enum, priorityRank hook, and assigneeSnapshot"
  - "Employee CRUD API (/api/employees) with 409 duplicate detection, On Leave date ordering, assigneeSnapshot sync, and 400 active-task deletion guard"
affects:
  - 01-02-PLAN
  - 02-query-aggregation-csv-export-deployment-readiness
  - 03-apple-hig-design-system-dashboard-employee-experience

plan_head_before: 786f0ee8f20c54dd1b32d8477069cd3b129e3b1f
plan_head_after: 00fee27f516e29642694c58889ad4f9a1348cf2f

actuals:
  tokens: 8667
  tasks: 3
  commits: 3

tech-stack:
  added:
    - "express@^5.1.0"
    - "mongoose@^8.13.0"
    - "zod@^3.24.2"
    - "cors@^2.8.5"
    - "helmet@^8.0.0"
    - "morgan@^1.10.0"
    - "dotenv@^16.4.7"
    - "vitest@^2.1.8"
    - "supertest@^7.0.0"
    - "mongodb-memory-server@^10.1.3"
  patterns:
    - "Express 5 read-only req.query compliance via req.validated = { body, query, params }"
    - "UTC calendar-date normalization (YYYY-MM-DDT00:00:00.000Z) eliminating local timezone drift"
    - "Dual live-reference (assignee ObjectId) + embedded assigneeSnapshot for non-destructive historical task retention"
    - "Central 4-argument Express 5 async error handler mapping ApiError, ZodError, E11000 (409), and Mongoose ValidationError/CastError"

key-files:
  created:
    - "server/package.json"
    - "server/.env.example"
    - "server/vitest.config.js"
    - "server/src/config/env.js"
    - "server/src/config/db.js"
    - "server/src/constants/enums.js"
    - "server/src/utils/ApiError.js"
    - "server/src/utils/dates.js"
    - "server/src/middleware/validate.js"
    - "server/src/middleware/validateObjectId.js"
    - "server/src/middleware/errorHandler.js"
    - "server/src/models/Counter.js"
    - "server/src/models/Employee.js"
    - "server/src/models/Task.js"
    - "server/src/validators/employee.validator.js"
    - "server/src/services/employee.service.js"
    - "server/src/controllers/employee.controller.js"
    - "server/src/routes/employee.routes.js"
    - "server/src/app.js"
    - "server/src/server.js"
  modified: []

key-decisions:
  - "Default backend HTTP port to 5001 in env.js and .env.example to avoid macOS AirPlay Receiver conflicts on port 5000"
  - "Support both direct body Zod schemas and { body, query, params } target maps in validate() middleware while storing results on req.validated"
  - "Sync assigneeSnapshot on employee update from the persisted Employee document rather than raw request payload so partial profile updates never overwrite untouched snapshot fields"
  - "Return HTTP 400 for broken business rules (deleting employee with active Todo/In Progress tasks) and HTTP 409 strictly for duplicate employeeId/email conflicts"

patterns-established:
  - "Routes -> Controllers -> Services -> Mongoose Models separation with zero DB queries in controllers"
  - "Strict 24-hex-character + mongoose.Types.ObjectId.isValid check in validateObjectId returning 404 ApiError"
  - "Pre-validate schema hooks enforcing UTC midnight normalization and conditional On Leave date clearing"

requirements-completed:
  - RULE-01
  - RULE-03
  - RULE-09
  - API-01
  - API-06

coverage:
  - id: D1
    description: "Express 5 ESM server foundation, /api/health endpoint, cached Mongoose connection, and central 400/404/409 error handler"
    requirement: API-06
    verification:
      - kind: integration
        ref: "node --input-type=module supertest(/api/health, /api/does-not-exist, /api/employees/not-a-valid-id)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Strict 5-department enum (Development, Design, QA, HR, Sales) without authentication and conditional On Leave date ordering (leaveEnd >= leaveStart)"
    requirement: RULE-01
    verification:
      - kind: integration
        ref: "MongoMemoryServer + supertest POST/PUT /api/employees department & leave window checks"
        status: pass
    human_judgment: false
  - id: D3
    description: "Employee CRUD endpoints enforcing uppercase employeeId, lowercase email, 409 conflict detection, and assigneeSnapshot sync on profile edits"
    requirement: API-01
    verification:
      - kind: integration
        ref: "MongoMemoryServer + supertest POST/GET/PUT /api/employees & GET /api/employees/:id/tasks"
        status: pass
    human_judgment: false
  - id: D4
    description: "Employee deletion guard blocking active Todo/In Progress tasks with 400 and preserving historical task assigneeSnapshot (isDeleted: true, assignee: null) upon eligible deletion"
    requirement: RULE-09
    verification:
      - kind: integration
        ref: "MongoMemoryServer + supertest DELETE /api/employees/:id active-task block & historical snapshot preservation check"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-11-16
status: complete
---

# Phase 1 Plan 01: Server Foundation, Mongoose Schemas & Employee Vertical Slice Summary

**Node.js 24 ESM + Express 5 backend foundation with UTC calendar-date utilities, Counter/Employee/Task Mongoose 8 schemas, central 400/404/409 error handling, and full Employee CRUD with assigneeSnapshot sync and active-task deletion protection**

## Performance

- **Duration:** 10 min
- **Started:** 2026-11-16T12:13:35Z
- **Completed:** 2026-11-16T12:23:52Z
- **Tasks:** 3
- **Files modified:** 21 (20 source/config files + `server/package-lock.json`)

## Accomplishments

- Initialized `server/` as a clean Node.js 24 ES Module package with Express 5, Mongoose 8, Zod v3.24, CORS (`Content-Disposition` exposed), Helmet, Morgan, and Vitest + Supertest + `mongodb-memory-server`.
- Built core infrastructure: `ApiError` (`400`/`404`/`409`/`500`), timezone-drift-free UTC midnight date helpers (`parseUtcCalendarDate`, `formatUtcDate`, `isDateInRangeInclusive`), Express 5-safe `validate` middleware (`req.validated`), 24-hex `validateObjectId` middleware, cached serverless-safe `connectDB()`, and central `errorHandler`.
- Implemented `Counter` (`getNextSequence`), `Employee` (5 departments, uppercase `employeeId`, lowercase `email`, `activeTaskCount` `0..3`, conditional `On Leave` date ordering & auto-clearing), and `Task` (`TSK-0001`, `priorityRank` `1..4`, UTC dates, nullable `assignee` + embedded `assigneeSnapshot`) Mongoose schemas.
- Delivered the complete `/api/employees` CRUD vertical slice (`GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `GET /:id/tasks`) with `409` duplicate checks, partial-update-safe `assigneeSnapshot` synchronization onto existing tasks, and `400` deletion protection preserving historical snapshots (`assignee: null`, `assigneeSnapshot.isDeleted: true`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold server environment, core infrastructure, and end-to-end Express 5 foundation** - `c20fbf5` (feat)
2. **Task 2: Implement Counter, Employee, and Task Mongoose schemas** - `a4edc36` (feat)
3. **Task 3: Implement Employee CRUD API vertical slice with validation, snapshot sync, and deletion protection** - `00fee27` (feat)

## Files Created/Modified

- `server/package.json` - Node.js 24 ESM manifest with Express 5, Mongoose 8, Zod, and Vitest scripts
- `server/.env.example` - Committed environment variable template (`PORT=5001`, `MONGODB_URI`, `CORS_ORIGIN`, `APP_TIMEZONE`)
- `server/vitest.config.js` - Vitest Node test runner configuration
- `server/src/config/env.js` - Environment loader resolving `server/.env` reliably across working directories
- `server/src/config/db.js` - Global cached Mongoose connection helper with `bufferCommands: false`
- `server/src/constants/enums.js` - Canonical `DEPARTMENTS`, `EMPLOYEE_STATUS`, `TASK_STATUS`, `TASK_PRIORITY`, `PRIORITY_RANKS`, and `STATUS_TRANSITIONS`
- `server/src/utils/ApiError.js` - Structured HTTP error class with `badRequest`, `notFound`, `conflict`, and `internal` factories
- `server/src/utils/dates.js` - Rollover-checked UTC midnight calendar-date parser, formatter, and inclusive range comparator
- `server/src/middleware/validate.js` - Express 5-compatible Zod validator populating `req.validated` without mutating `req.query`
- `server/src/middleware/validateObjectId.js` - Strict 24-char hex ObjectId route param guard returning `404`
- `server/src/middleware/errorHandler.js` - Central 4-argument Express error middleware mapping `ApiError`, `ZodError`, `E11000`, and Mongoose errors
- `server/src/models/Counter.js` - Atomic `findOneAndUpdate` sequence generator for `TSK-0001` IDs
- `server/src/models/Employee.js` - Employee schema with unique `employeeId`/`email`, 5-department enum, `activeTaskCount` bounds, and leave validation hook
- `server/src/models/Task.js` - Task schema with `priorityRank` computation and embedded `assigneeSnapshot`
- `server/src/validators/employee.validator.js` - Zod create/update schemas enforcing department enum and `leaveEnd >= leaveStart`
- `server/src/services/employee.service.js` - Employee business logic, `409` duplicate checks, snapshot sync, and `400` active-task deletion guard
- `server/src/controllers/employee.controller.js` - Express 5 async controllers for `/api/employees`
- `server/src/routes/employee.routes.js` - Express router mounting Employee CRUD and `GET /:id/tasks`
- `server/src/app.js` - Express 5 application instance with middleware stack, `/api/health`, `/api/employees`, 404 handler, and `errorHandler`
- `server/src/server.js` - Local HTTP listener connecting to MongoDB and binding `PORT` (`5001`)

## Decisions Made

- **Port 5001 default (`D-03`):** Configured `PORT=5001` in `env.js`, `.env.example`, and local gitignored `server/.env` so macOS AirPlay Receiver on port `5000` never collides with local development.
- **Partial-update-safe `assigneeSnapshot` sync:** Synced `Task.updateMany` snapshot fields from the saved `Employee` document rather than raw `req.body` fields so partial `PUT /api/employees/:id` updates (e.g., updating `fullName` and `role` only) never overwrite `email` or `department` with `undefined`/`null`.
- **Dual-mode `validate()` middleware:** Supported passing either a direct body Zod schema (`validate(createEmployeeSchema)`) or a `{ body, query, params }` map so both Phase 1 CRUD routes and Phase 2 query-validated endpoints share one middleware cleanly.
- ** Vitest `passWithNoTests: true`:** Enabled `passWithNoTests: true` in `server/vitest.config.js` so `npm --prefix server run test` exits cleanly in Wave 1 before Wave 2 (`01-02`) adds `server/tests/*.test.js`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug Prevention] Synced `assigneeSnapshot` from persisted `Employee` document instead of raw `data` payload**
- **Found during:** Task 3 (`employee.service.js` implementation)
- **Issue:** Using `data.email` / `data.department` directly in `Task.updateMany` during a partial `PUT /api/employees/:id` request (such as updating only `fullName` and `role`) would overwrite unspecified snapshot fields with `null`/`undefined`.
- **Fix:** Saved the updated `Employee` instance first and populated all five `assigneeSnapshot` fields from the persisted `employee` document whenever any snapshot-relevant field changed.
- **Files modified:** `server/src/services/employee.service.js`
- **Verification:** Verified via `MongoMemoryServer` + `supertest` partial `PUT /api/employees/:id` test confirming `fullName` updated while `email` and `department` remained intact on the task's `assigneeSnapshot`.
- **Committed in:** `00fee27` (Task 3 commit)

**2. [Rule 2 - Correctness] Added calendar-date rollover validation and strict 24-hex ObjectId check**
- **Found during:** Task 1 (`dates.js` and `validateObjectId.js` implementation)
- **Issue:** Native `Date.UTC(2026, 1, 31)` silently rolls Feb 31 into March 3, and `mongoose.Types.ObjectId.isValid()` accepts arbitrary 12-character ASCII strings that fail downstream queries.
- **Fix:** Added year/month/day round-trip verification in `parseUtcCalendarDate` and `/^[0-9a-fA-F]{24}$/` verification in `validateObjectId`.
- **Files modified:** `server/src/utils/dates.js`, `server/src/middleware/validateObjectId.js`
- **Verification:** Verified invalid dates return `400` and non-hex IDs return `404`.
- **Committed in:** `c20fbf5` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug prevention, 1 correctness hardening)
**Impact on plan:** Both refinements directly strengthen business rule accuracy and prevent subtle Mongoose/JS date pitfalls with zero scope creep.

## Issues Encountered

None — all dependencies installed cleanly on Node `v24.5.0` and `MongoMemoryServer` (`7.0.24`) verified all endpoints end-to-end on the first run.

## User Setup Required

None - `server/.env` (gitignored) and `server/.env.example` are pre-configured for local MongoDB (`mongodb://127.0.0.1:27017/roots_ems`) on `PORT=5001`.

## Next Phase Readiness

- Ready for **Plan `01-02`**: `Counter`, `Employee`, `Task`, `enums.js`, `dates.js`, `ApiError`, `validate`, `validateObjectId`, and `app.js` are all in place and verified for Task CRUD, atomic 3-task capacity claiming, `On Leave` boundary checks, `PUT /api/tasks/:id/status` transitions, and the full Vitest integration test suite.
- Note: `RULE-03` (employee leave date ordering complete; task `dueDate >= startDate` completed in `Task` model and wired into `task.validator.js` in `01-02`) and `API-06` are shared with `01-02`.

## Self-Check: PASSED

- All 21 created server/planning files verified present on disk (`server/.env` also present and gitignored).
- All 3 atomic task commits (`c20fbf5`, `a4edc36`, `00fee27`) verified in git history.

---
*Phase: 01-backend-core-schemas-business-rules-engine*
*Completed: 2026-11-16*
