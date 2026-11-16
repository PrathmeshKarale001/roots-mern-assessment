# Phase 1: Backend Core, Schemas & Business Rules Engine - Context

**Gathered:** 2026-11-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the `server/` Node.js 24 ESM + Express 5 + Mongoose 8 foundation, UTC calendar-date utilities, `Counter` / `Employee` / `Task` schemas, central `ApiError` (`400`, `404`, `409`) handling, Employee CRUD + deletion guard + `assigneeSnapshot` sync, and Task CRUD + dedicated `PUT /api/tasks/:id/status` state machine + concurrency-safe 3-active-task capacity & inclusive leave-overlap enforcement, verified by an automated Vitest + Supertest + `mongodb-memory-server` test suite.

Advanced multi-parameter filtering, sorting, pagination metadata refinement, dashboard `$facet` aggregation, streaming CSV export, seed script, and Vercel serverless entry are delivered in Phase 2 (basic list endpoints in Phase 1 can already support clean baseline listing or wire into Phase 2's query builder).
</domain>

<decisions>
## Implementation Decisions

### Stack & Runtime (`server/`)
- **D-01**: Use Node.js ESM (`"type": "module"` in `server/package.json`), Express `^5.1.0` (or latest 5.x), Mongoose `^8.x`, `zod@^3.24.2` (pinned to v3.24.x so server & client share universal `.safeParse()` / `@hookform/resolvers` ergonomics without Zod v4 breaking syntax surprises), `cors`, `helmet`, `morgan`, `dotenv`, and devDependencies `vitest`, `supertest`, `mongodb-memory-server`.
- **D-02**: In Express 5, `req.query` is a read-only getter — validation middleware MUST store parsed payloads on `req.validated = { body, query, params }` (while updating `req.body` safely) and NEVER assign `req.query = ...`.
- **D-03**: Separate `server/src/app.js` (pure Express app + `/api/health` + DB connection middleware when `MONGODB_URI` is configured and `mongoose.connection.readyState !== 1`) from `server/src/server.js` (local HTTP listener on `PORT=5001` default — avoiding macOS AirPlay Receiver conflict on port `5000`!).

### Data Models & UTC Date Discipline
- **D-04**: All calendar date fields (`joiningDate`, `leaveStart`, `leaveEnd`, `startDate`, `dueDate`) are validated as `YYYY-MM-DD` strings (or ISO strings parsed strictly to calendar dates without timezone drift) and persisted as UTC midnight `Date` (`YYYY-MM-DDT00:00:00.000Z`). `completedDate` is set exclusively by the server (`new Date()`) upon transitioning to `Completed`.
- **D-05**: `Employee` schema enforces `department` enum (`Development`, `Design`, `QA`, `HR`, `Sales`), `status` enum (`Active`, `Inactive`, `On Leave`), unique uppercase-trimmed `employeeId`, unique lowercase-trimmed `email`, conditional `leaveStart` & `leaveEnd` (`leaveEnd >= leaveStart` required when `status === 'On Leave'`, automatically cleared to `null` otherwise), and `activeTaskCount` (`min: 0, max: 3, default: 0`).
- **D-06**: `Task` schema uses atomic `Counter` (`findOneAndUpdate({ _id: 'taskId' }, { $inc: { seq: 1 } }, { upsert: true, new: true })`) to format `TSK-0001` (`padStart(4, '0')`), stores `assignee` (`ObjectId` ref to `Employee`, nullable after deletion) AND `assigneeSnapshot` (`{ employeeId, fullName, email, department, role, isDeleted: false }`), `priority` (`Low`, `Medium`, `High`, `Critical`) + `priorityRank` (`1..4`), and `status` (`Todo`, `In Progress`, `Completed`, `Cancelled`).

### Business Rule & Concurrency Invariants
- **D-07**: Capacity & Assignment Guard (`claimEmployeeCapacity`):
  - Pre-read employee first for crystal-clear `404` ("Assigned employee not found") or `400` messages ("Cannot assign tasks to an Inactive employee", "Employee is on leave during the task start date (... to ...)", "Employee already holds the maximum of 3 active tasks"), THEN execute a single-document atomic conditional `Employee.findOneAndUpdate` encoding `_id`, `activeTaskCount: { $lt: 3 }`, and `$or` (`status: 'Active'` OR `{ status: 'On Leave', $or: [{ leaveStart: { $gt: startDate } }, { leaveEnd: { $lt: startDate } }] }`) with `{ $inc: { activeTaskCount: 1 } }`. If the atomic update returns `null` (lost a concurrent race), re-check and throw `400` ("Employee already holds the maximum of 3 active tasks"). Wrap subsequent Task creation/update in `try/catch` to roll back (`$inc: { activeTaskCount: -1 }` where `activeTaskCount: { $gt: 0 }`) on failure.
- **D-08**: Lifecycle Mutations:
  - `POST /api/tasks` & `PUT /api/tasks/:id` strictly reject (`400`) any request body containing `status` or `completedDate` (use Zod `.strict()` or explicit forbidden-key refinement with clear rule message).
  - Editing a `Completed` or `Cancelled` task via `PUT /api/tasks/:id` throws `400` ("Completed or Cancelled tasks cannot be edited").
  - Reassigning an active task (`A -> B`) claims capacity on `B` first, updates the task + `assigneeSnapshot`, and releases `A`'s slot; editing `startDate` on the same `On Leave` assignee re-validates `[leaveStart, leaveEnd]` inclusive.
  - `PUT /api/tasks/:id/status` validates `TRANSITIONS = { 'Todo': ['In Progress', 'Cancelled'], 'In Progress': ['Completed', 'Cancelled'], 'Completed': [], 'Cancelled': [] }`, uses atomic compare-and-swap `{ _id, status: currentStatus }`, sets `completedDate = new Date()` when target is `Completed`, and decrements `assignee.activeTaskCount` when transitioning from `Todo`/`In Progress` to `Completed`/`Cancelled`.
  - `DELETE /api/tasks/:id` decrements `assignee.activeTaskCount` if the deleted task was `Todo` or `In Progress`.
  - `DELETE /api/employees/:id` checks both `activeTaskCount > 0` AND `Task.countDocuments({ assignee: id, status: { $in: ['Todo', 'In Progress'] } }) > 0` (blocking with `409` or `400` — use `400` or `409`; let's return `400` or `409`? Wait: PDF says "Return proper errors: 400 invalid data or broken rule, 404 not found, 409 duplicate employee ID or email" — so broken business rule = **`400`**, duplicate employee ID or email = **`409`**! Locking `400` for broken delete rule and `409` strictly for duplicate `employeeId`/`email` matches the PDF rubric verbatim!). Upon deleting an eligible employee, update their historical tasks (`Task.updateMany({ assignee: id }, { $set: { assignee: null, 'assigneeSnapshot.isDeleted': true } })`) so historical tasks retain full `assigneeSnapshot` details!
  - Updating an Employee (`PUT /api/employees/:id`) syncs `assigneeSnapshot` (`employeeId`, `fullName`, `email`, `department`, `role`) onto existing tasks referencing that employee (`Task.updateMany({ assignee: id }, ...)`), and if transitioning employee status to `Inactive` while holding active tasks, either block with `400` ("Cannot mark employee Inactive while holding active tasks") or allow only when `activeTaskCount === 0` — blocking `Active -> Inactive` when holding active tasks keeps data 100% consistent (or only enforce on new/reassigned task assignment if tests set employee Inactive; wait: let's check the PDF: "Assignment: a task can be given only to an Active employee. Inactive employee: always rejected." Allowing an employee to be created as `Inactive` or updated to `Inactive` MUST work so evaluators can test assigning a task to an `Inactive` employee! So `POST`/`PUT /api/employees` freely allows setting status to `Active`, `Inactive`, or `On Leave`!).
</decisions>

<deferred>
## Deferred Ideas

- Full query builder (`search`, multi-filters, `priorityRank` sort, pagination), `/api/dashboard`, `/api/tasks/export.csv`, `npm run seed`, and `server/api/index.js` — Planned for Phase 2.
</deferred>
