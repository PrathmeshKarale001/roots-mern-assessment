# Phase 2: Server Query Engine, Dashboard Aggregation, CSV Export & Seed - Context

**Gathered:** 2026-11-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the entire backend API surface on top of Phase 1's schemas and business rules: shared UTC overdue engine (`RULE-08`), composable server-side search/filter/importance-sort/pagination on `/api/tasks` and `/api/employees` (`API-03`), filter-synced RFC-4180 streaming CSV export (`API-04`), server-aggregated `/api/dashboard` and `/api/meta` endpoints (`API-05`), standalone `npm run seed` script + Vercel serverless `server/api/index.js` & `server/vercel.json` (`DOC-01`), and automated Vitest + Supertest integration tests (`API-07`).
</domain>

<decisions>
## Implementation Decisions

### Shared Overdue Engine (`RULE-08`)
- **D-01**: Centralize overdue logic in `server/src/utils/overdue.js` (building on `dates.js` `getTodayUtcMidnight()`):
  - Predicate: a task is overdue iff `dueDate < todayUtcMidnight` AND `status` is NOT in `['Completed', 'Cancelled']` (tasks due *today* are NOT overdue; PDF states: `"today is later than Due Date and status is not Completed or Cancelled"`).
  - Export `buildOverdueMongoFilter(todayUtc)`, `computeTaskOverdueFields(taskDoc, todayUtc)` returning `{ isOverdue, daysOverdue }`, and apply `enrichTaskWithOverdue()` consistently in `task.service.js` (list, getById, create, update, updateStatus), `employee.service.js` (`getEmployeeTasks`), `dashboard.service.js`, and `csv.service.js`.

### Composable Server Query Engine (`API-03`)
- **D-02**: Create `server/src/utils/queryBuilder.js` with `escapeRegex(str)` (preventing ReDoS / `C++` regex syntax crashes):
  - **Task Query Builder (`buildTaskFilterQuery` & `buildTaskSortSpec`)**:
    - `search`: case-insensitive escaped regex matching `title`, `taskId`, OR `assigneeSnapshot.fullName` (satisfies PDF `"Search (task title, employee name)"` without requiring `$lookup` joins!).
    - Composable filters (all optional, combined via `$and`): `department` (enum), `priority` (enum), `status` (enum), `assignee` (ObjectId), `overdue` (`'true'` -> overdue Mongo condition; `'false'` -> `$nor: [overdueCondition]`), `dueDate` (exact `YYYY-MM-DD` match), `dueFrom` / `dueTo` (`YYYY-MM-DD` inclusive range on `dueDate`), and `duePreset` (`'overdue' | 'today' | 'upcoming_7d'`).
    - Sorting (`sortBy` + `sortOrder` `'asc' | 'desc'`, default `createdAt: -1`):
      - `'createdAt'` -> `{ createdAt: dir, _id: dir }`
      - `'dueDate'` -> `{ dueDate: dir, priorityRank: -1, _id: 1 }`
      - `'priority'` -> `{ priorityRank: dir, dueDate: 1, _id: 1 }` (sorts by importance `Low=1, Medium=2, High=3, Critical=4`, NEVER alphabetically!)
      - `'title'` -> `{ title: dir, _id: 1 }` (with case-insensitive collation `{ locale: 'en', strength: 2 }` or normalized sort)
    - Pagination: `page` (default `1`, min `1`), `limit` (default `10`, min `1`, max `100`), returning `{ success: true, data, pagination: { page, limit, total, totalPages, hasNextPage, hasPrevPage } }` (maintain clean backward-compatible response envelope with Phase 1 tests — check `employees.test.js` & `tasks-rules.test.js` response shapes before changing any existing top-level keys!).
  - **Employee Query Builder (`buildEmployeeFilterQuery` & `buildEmployeeSortSpec`)**:
    - `search` across `fullName`, `email`, `employeeId`, `role`; filters `department`, `status`; `sortBy` (`createdAt`, `fullName`, `joiningDate`, `activeTaskCount`, `employeeId`) + `sortOrder`; `page` & `limit` (plus `GET /api/employees/options` or `limit=100` for task form assignee picker).

### Filter-Synced Streaming CSV Export (`API-04`)
- **D-03**: Mount `GET /api/tasks/export.csv` AND alias `GET /api/tasks/export` in `task.routes.js` **strictly BEFORE** `/:id`:
  - Validates query params with the exact same filter/sort Zod schema as `GET /api/tasks` (ignoring `page`/`limit` so ALL matching tasks stream, not just the visible page).
  - Sets `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="roots-tasks-YYYY-MM-DD.csv"` (and update `cors` in `app.js` with `exposedHeaders: ['Content-Disposition']`).
  - Writes UTF-8 BOM `\uFEFF`, streams via Mongoose `.find(filter).sort(sortSpec).lean().cursor()`, formats RFC-4180 cells with formula-injection neutralization (`^[=+\-@]` prefixed safely on untrusted text fields), and includes columns: `Task ID,Title,Description,Assigned Employee,Employee ID,Employee Status,Department,Priority,Status,Overdue,Start Date,Due Date,Completed Date,Created Date` (rendering `"Former Employee"` when `assigneeSnapshot.isDeleted` is true, and `Yes`/`No` for `Overdue`).

### Server Dashboard Aggregation & Meta Endpoint (`API-05`)
- **D-04**: Implement `GET /api/dashboard` (`dashboard.service.js`, `dashboard.controller.js`, `dashboard.routes.js`) and `GET /api/meta`:
  - All counts and workloads MUST be computed on MongoDB/server (zero client-side counting):
    - `employees`: `{ total, active, onLeave, inactive, byDepartment }`
    - `tasks`: `{ total, todo, inProgress, completed, cancelled, overdue, activeTasks, completionRate, byStatus, byPriority, byDepartment }`
    - `workload`: array of employees (`_id`, `employeeId`, `fullName`, `email`, `department`, `role`, `status`, `activeTaskCount`, `maxCapacity: 3`, `availableSlots`, `leaveStart`, `leaveEnd`) sorted by `activeTaskCount` desc, `fullName` asc
    - `overdueTasks`: top 10 overdue tasks enriched with `isOverdue: true` and `daysOverdue`, sorted by `dueDate` asc, `priorityRank` desc
    - `recentTasks`: latest 6 tasks enriched with `isOverdue`
  - `GET /api/meta`: returns `{ departments, employeeStatuses, taskStatuses, priorities, priorityRanks, validTransitions, maxActiveTasks: 3 }`.

### Seed Script & Vercel Serverless Config (`DOC-01`)
- **D-05**: Create standalone `server/scripts/seed.js` (`"seed": "node scripts/seed.js"` in `server/package.json`), strictly decoupled from runtime code:
  - Populates 10 diverse employees across all 5 departments (`Development`, `Design`, `QA`, `HR`, `Sales`) covering `0/3`, `1/3`, `2/3`, `3/3` workloads, `On Leave` window, and `Inactive`, plus ~16 realistic tasks across all priorities, statuses, overdue dates, and 1 historical completed task whose former employee was deleted (`assignee: null, assigneeSnapshot.isDeleted: true`), keeping `Counter` (`seq`) and `Employee.activeTaskCount` 100% consistent.
- **D-06**: Create `server/api/index.js` (default-exporting `app` from `../src/app.js`) and `server/vercel.json` (`rewrites: [{ "source": "/(.*)", "destination": "/api" }]`), and verify `app.js` ensures `connectDB()` runs automatically on requests when `MONGODB_URI` is set and `mongoose.connection.readyState === 0` (without interfering when `mongodb-memory-server` already established `readyState === 1`).

### Phase 2 Automated Tests (`API-07`)
- **D-07**: Add `server/tests/query-dashboard-csv.test.js` verifying combined search (title + employee name), multi-filter composition, `priority` importance sort (`Critical > High > Medium > Low`), pagination metadata, overdue consistency across all 4 surfaces (list, detail, dashboard, CSV), full-dataset filtered CSV export (including deleted employee snapshot), `/api/dashboard` counts & workload accuracy, and `/api/meta` — while keeping all 14 Phase 1 tests passing (`npm --prefix server run test`).
</decisions>

<deferred>
## Deferred Ideas

- React frontend SPA, Apple HIG CSS tokens, and root `README.md` — Planned for Phases 3 and 4.
</deferred>
