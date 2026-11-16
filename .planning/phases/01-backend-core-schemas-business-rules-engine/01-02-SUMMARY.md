---
phase: 01-backend-core-schemas-business-rules-engine
plan: 02
subsystem: api
tags: [nodejs, express5, mongoose8, zod, vitest, supertest, mongodb-memory-server, concurrency]

requires:
  - phase: 01-backend-core-schemas-business-rules-engine
    provides: "Express 5 app foundation, Counter/Employee/Task Mongoose schemas, UTC date utilities, and Employee CRUD API (01-01)"
provides:
  - "Zod task validation schemas strictly rejecting client-supplied status/completedDate and enforcing dueDate >= startDate"
  - "Task CRUD vertical slice (/api/tasks) with atomic TSK-0001 sequence generation and populated assignee details"
  - "Business Rules Engine enforcing Inactive rejection, inclusive On Leave [leaveStart, leaveEnd] blocking, and concurrency-safe 3-active-task capacity via single-document conditional $inc + rollback"
  - "Dedicated PUT /api/tasks/:id/status compare-and-swap state machine stamping server-authoritative completedDate and releasing capacity slots"
  - "Permanent terminal edit lock (400) on Completed and Cancelled tasks and atomic slot transfer on task reassignment/deletion"
  - "Comprehensive Vitest + Supertest + mongodb-memory-server integration test suites (14 passing tests across employees and tasks)"
affects:
  - 02-query-aggregation-csv-export-deployment-readiness
  - 03-apple-hig-design-system-dashboard-employee-experience
  - 04-task-management-workflows-csv-ui-submission-polish

plan_head_before: ad03607c12c470f41562d7dfaa7a5ae8894619bc
plan_head_after: 6c0a6debbe3378fb4bf5106388725611d7936dc3

actuals:
  tokens: 12368
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Single-document atomic conditional $inc (activeTaskCount: { $lt: 3 } + status/leave window predicate) with compensating rollback for standalone mongod race safety"
    - "Atomic compare-and-swap status transitions ({ _id, status: currentStatus }) preventing out-of-order concurrent transitions"
    - "Explicit Zod forbidden-field refinement + post-parse key stripping so status and completedDate cannot be spoofed or silently ignored"
    - "Mongoose createIndexes() after MongoMemoryServer connection when global bufferCommands: false is active"

key-files:
  created:
    - "server/src/validators/task.validator.js"
    - "server/src/services/task.service.js"
    - "server/src/controllers/task.controller.js"
    - "server/src/routes/task.routes.js"
    - "server/tests/employees.test.js"
    - "server/tests/tasks-rules.test.js"
  modified:
    - "server/src/app.js"

key-decisions:
  - "Declare status and completedDate as z.unknown().optional() inside task create/update Zod objects before superRefine so Zod v3 does not silently strip them prior to throwing 400 validation errors"
  - "Claim capacity on target assignee B and persist task save before releasing prior assignee A (with rollback on B if save throws) so activeTaskCount never drifts on partial failures"
  - "Use atomic Task.findByIdAndDelete in deleteTask so concurrent delete requests cannot double-decrement an assignee's activeTaskCount"
  - "Call Model.createIndexes() after mongoose.connect() in MongoMemoryServer tests rather than Model.init() because bufferCommands: false rejects boot-time $init before connection"

patterns-established:
  - "Pre-read domain entity for deterministic 404/400 rule messages followed by single-document atomic MongoDB conditional update for concurrency enforcement"
  - "Isolated ephemeral MongoMemoryServer per test file with collection reset in beforeEach and index synchronization in beforeAll"

requirements-completed:
  - RULE-01
  - RULE-02
  - RULE-03
  - RULE-04
  - RULE-05
  - RULE-06
  - RULE-07
  - API-02
  - API-06

coverage:
  - id: D1
    description: "Task CRUD API (/api/tasks) with sequential TSK-0001 generation, dueDate >= startDate checks, and strict 400 rejection of client status/completedDate"
    requirement: API-02
    verification:
      - kind: integration
        ref: "server/tests/tasks-rules.test.js#auto-generates sequential TSK-0001 and TSK-0002 IDs with default Todo status and priorityRank (API-02)"
        status: pass
      - kind: integration
        ref: "server/tests/tasks-rules.test.js#strictly rejects client-supplied status or completedDate on POST and PUT /api/tasks/:id with 400 (RULE-04, RULE-06)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Employee assignment guards rejecting Inactive employees and enforcing inclusive On Leave [leaveStart, leaveEnd] across all 5 boundary dates"
    requirement: RULE-02
    verification:
      - kind: integration
        ref: "server/tests/tasks-rules.test.js#rejects assigning or reassigning tasks to Inactive employees with 400 (RULE-02)"
        status: pass
      - kind: integration
        ref: "server/tests/tasks-rules.test.js#enforces inclusive On Leave window across all 5 boundary dates (2026-06-10 to 2026-06-20) (RULE-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Concurrency-safe 3-active-task capacity enforcement via atomic conditional $inc under sequential and Promise.all burst requests plus reassignment/deletion slot accounting"
    requirement: RULE-07
    verification:
      - kind: integration
        ref: "server/tests/tasks-rules.test.js#enforces 3-active-task capacity limit sequentially and under concurrent Promise.all bursts (RULE-07)"
        status: pass
      - kind: integration
        ref: "server/tests/tasks-rules.test.js#transfers capacity cleanly on reassignment (A -> B -> null) and releases slot upon completion (RULE-07)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Dedicated PUT /api/tasks/:id/status state machine stamping server-authoritative completedDate and locking Completed/Cancelled tasks from edits or further transitions"
    requirement: RULE-04
    verification:
      - kind: integration
        ref: "server/tests/tasks-rules.test.js#enforces the status transition state machine, stamps server completedDate, and locks terminal tasks from edits (RULE-04, RULE-05, RULE-06)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Automated Vitest integration test suite certifying Employee department enums, 409 unique constraints, leave ordering, snapshot sync, and active-task deletion protection"
    requirement: RULE-01
    verification:
      - kind: integration
        ref: "server/tests/employees.test.js#Employee API & Domain Rules (/api/employees)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-11-16
status: complete
---

# Phase 1 Plan 02: Task Vertical Slice, Business Rules Engine & Automated Test Suite Summary

**Task CRUD vertical slice, dedicated CAS status state machine, concurrency-safe 3-task atomic capacity & inclusive leave-window guards, and a 14-test Vitest + Supertest + `mongodb-memory-server` integration suite**

## Performance

- **Duration:** 10 min
- **Started:** 2026-11-16T12:29:12Z
- **Completed:** 2026-11-16T12:39:40Z
- **Tasks:** 3
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments

- Implemented `task.validator.js`, `task.controller.js`, `task.routes.js`, and `/api/tasks` wiring in `app.js` enforcing `dueDate >= startDate` and strictly rejecting client-supplied `status` or `completedDate` on task creation and general edits (`400`).
- Implemented the complete Business Rules Engine in `task.service.js`: sequential `TSK-0001` counter IDs, `claimEmployeeCapacity` (blocking `Inactive` employees, enforcing inclusive `On Leave` `[leaveStart, leaveEnd]` overlap, and executing single-document atomic conditional `$inc` `< 3` with rollback), `releaseEmployeeCapacity`, safe `A -> B -> null` reassignment slot transfers, terminal `Completed`/`Cancelled` edit locks, and atomic CAS `PUT /api/tasks/:id/status` transitions stamping server-authoritative `completedDate`.
- Built and passed 14 comprehensive integration tests across `server/tests/employees.test.js` (6 tests) and `server/tests/tasks-rules.test.js` (8 tests) running against ephemeral `MongoMemoryServer` instances—proving all 5 departments, `409` duplicate checks, snapshot sync, active-task deletion guards, all 5 `On Leave` boundary dates, state transitions, and concurrent `Promise.all` 4th-task burst protection.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement Task validator, routes, and baseline CRUD vertical slice** - `bfa8f70` (feat)
2. **Task 2: Implement Business Rules Engine: atomic capacity, leave guard, and status state machine** - `4cd8f8f` (feat)
3. **Task 3: Implement automated Vitest test suite covering all business rules and concurrent race protection** - `6c0a6de` (test)

## Files Created/Modified

- `server/src/validators/task.validator.js` - Zod schemas for task create, update, and dedicated status transition endpoints
- `server/src/services/task.service.js` - Atomic capacity manager (`claimEmployeeCapacity`, `releaseEmployeeCapacity`), leave overlap checks, CAS status state machine, and Task CRUD
- `server/src/controllers/task.controller.js` - Express 5 async HTTP handlers for `/api/tasks` and `/api/tasks/:id/status`
- `server/src/routes/task.routes.js` - Express router mounting Task CRUD and dedicated `PUT /:id/status`
- `server/src/app.js` - Mounted `/api/tasks` alongside `/api/employees`
- `server/tests/employees.test.js` - Integration tests for `/api/health`, 5-department enum, `409` conflicts, leave dates, snapshot sync, and deletion guard
- `server/tests/tasks-rules.test.js` - Integration tests for `TSK-0001` sequence, forbidden fields, date ordering, `Inactive` & 5-boundary `On Leave` guards, concurrent `Promise.all` capacity burst, reassignment, state machine, and terminal edit locks

## Decisions Made

- **Explicit Zod forbidden-key capture before `superRefine`:** Included `status: z.unknown().optional()` and `completedDate: z.unknown().optional()` on `createTaskSchema` and `updateTaskSchema` followed by `.transform()` removal so Zod v3's default `.strip()` mode does not silently discard forbidden keys before `superRefine` emits `400` rule errors.
- **Failure-safe reassignment ordering (`claim B -> save task -> release A`):** Claimed capacity on new assignee `B` first, persisted `task.save()` with rollback on `B` if persistence failed, and released old assignee `A` only after save succeeded so `activeTaskCount` remains exact under any failure mode.
- **Atomic `findByIdAndDelete` slot release:** Used `Task.findByIdAndDelete(id)` in `deleteTask` so at most one concurrent caller receives the deleted active task document and decrements `activeTaskCount`.
- **`Model.createIndexes()` in `MongoMemoryServer` `beforeAll`:** Used `createIndexes()` after `mongoose.connect()` rather than `Model.init()` because `mongoose.set('bufferCommands', false)` rejects Mongoose's eager import-time `$init` promise before tests open an in-memory connection.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added baseline `task.service.js` in Task 1 before expanding full Business Rules Engine in Task 2**
- **Found during:** Task 1 (`task.controller.js` & `task.routes.js` verification)
- **Issue:** `task.controller.js` uses static ES Module `import taskService from '../services/task.service.js'`, which fails Task 1's ESM import check (`ERR_MODULE_NOT_FOUND`) if `task.service.js` does not exist until Task 2.
- **Fix:** Created a production-clean baseline CRUD `task.service.js` in Task 1 so the tracer vertical slice loaded and functioned end-to-end, then expanded `task.service.js` with full atomic capacity, leave guards, and state machine logic in Task 2.
- **Files modified:** `server/src/services/task.service.js`
- **Verification:** Both Task 1 tracer verification and Task 2 verification passed cleanly with `git bisect`-safe commits.
- **Committed in:** `bfa8f70` (Task 1) and `4cd8f8f` (Task 2)

**2. [Rule 1 - Bug] Prevented Zod v3 `.object()` default key stripping from bypassing `status`/`completedDate` prohibition**
- **Found during:** Task 1 (`task.validator.js` implementation)
- **Issue:** Standard `z.object({...}).superRefine(...)` in Zod v3 strips undeclared keys (`status`, `completedDate`) before `superRefine` runs, which would silently accept tampered payloads instead of returning `400`.
- **Fix:** Declared `status` and `completedDate` as `z.unknown().optional()` for `superRefine` inspection and stripped them in `.transform()` when absent.
- **Files modified:** `server/src/validators/task.validator.js`
- **Verification:** Verified via unit check and `server/tests/tasks-rules.test.js` (`POST` and `PUT` with `status` or `completedDate` deterministically return `400`).
- **Committed in:** `bfa8f70` (Task 1)

**3. [Rule 1 - Bug] Used `Model.createIndexes()` instead of cached `Model.init()` in test `beforeAll` with `bufferCommands: false`**
- **Found during:** Task 3 (`npm --prefix server run test`)
- **Issue:** Because `db.js` sets `mongoose.set('bufferCommands', false)` globally at import time, Mongoose 8's automatic `Model.$init` rejects before `beforeAll` connects to `MongoMemoryServer`, causing `Model.init()` to replay that cached rejection.
- **Fix:** Replaced `Model.init()` with `Employee.createIndexes()` and `Task.createIndexes()` after `mongoose.connect()` in both test files.
- **Files modified:** `server/tests/employees.test.js`, `server/tests/tasks-rules.test.js`
- **Verification:** All 14 tests across both suites passed in 3.3s with `409` unique index enforcement active.
- **Committed in:** `6c0a6de` (Task 3)

---

**Total deviations:** 3 auto-fixed (2 bug fixes, 1 blocking ESM module order fix)
**Impact on plan:** All auto-fixes directly ensured strict security/tamper rejection, clean ESM module loading, and reliable in-memory MongoDB index initialization. Zero scope creep.

## Issues Encountered

None beyond the Mongoose 8 `bufferCommands: false` `createIndexes()` adjustment resolved immediately during Task 3 test execution.

## User Setup Required

None - all automated tests run self-contained via `mongodb-memory-server` (`npm --prefix server run test`).

## Next Phase Readiness

- **Phase 1 is 100% complete:** All Employee & Task schemas, CRUD endpoints, dedicated status transition route, atomic 3-task capacity engine, inclusive leave-window checks, snapshot synchronization, deletion protections, and automated integration tests are green.
- Ready for **Phase 2 (`02-query-aggregation-csv-export-deployment-readiness`)**: Multi-parameter query builder (`search`, filters, `priorityRank` sorting, pagination metadata), overdue computation (`RULE-08`), `/api/dashboard` `$facet` aggregation, RFC-4180 CSV export (`/api/tasks/export/csv`), seed script, and Vercel serverless entry (`server/api/index.js`).

## Self-Check: PASSED

- All 7 created/modified files verified present on disk (`task.validator.js`, `task.service.js`, `task.controller.js`, `task.routes.js`, `app.js`, `employees.test.js`, `tasks-rules.test.js`, plus `01-02-SUMMARY.md`).
- All 3 atomic task commits (`bfa8f70`, `4cd8f8f`, `6c0a6de`) verified in git history.

---
*Phase: 01-backend-core-schemas-business-rules-engine*
*Completed: 2026-11-16*
