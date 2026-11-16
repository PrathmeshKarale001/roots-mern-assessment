# Pitfalls Research

**Domain:** MERN Employee & Task Management System (Strict Backend Invariants, Concurrency-Safe Capacity Control, & Rubric-Graded SPA)
**Researched:** 2026-11-16
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: TOCTOU Concurrency Race on 4th Active Task & Replica-Set Transaction Crash on Standalone `mongod` (README Q6)

**What goes wrong:**
Two failure modes hit the 3-active-task capacity rule (`Todo` + `In Progress` $\le 3$ per employee):
1. **Race condition (TOCTOU):** Two concurrent `POST /api/tasks` (or reassignment `PUT /api/tasks/:id`) requests target an employee who currently holds `2` active tasks. Both requests execute `Task.countDocuments({ assignee, status: { $in: ['Todo', 'In Progress'] } })`, both read `2`, both pass `if (count >= 3)`, and both insert a task — leaving the employee with **4 active tasks** and violating the core capacity invariant (explicitly tested by README Question 6).
2. **Standalone `mongod` crash:** Attempting to fix the race with `mongoose.startSession()` + `session.withTransaction()` works on MongoDB Atlas (replica set) but **crashes immediately on local standalone `mongod`** (`mongodb://127.0.0.1:27017/roots_ems`) with `MongoServerError: Transaction numbers are only allowed on a replica set member or mongos` (Error Code 20), breaking local grading out of the box.
3. **Auto-ID collision under concurrency:** Generating `TSK-001` via `Task.countDocuments() + 1` collides with `E11000 duplicate key error` under concurrent `Promise.all` task creations or after any task deletion.

**Why it happens:**
Read-then-write across two collections (`tasks` count check followed by `tasks` insert) has no isolation boundary in MongoDB without either multi-document transactions (unavailable on standalone `mongod`) or an atomic single-document gatekeeper on `Employee`.

**How to avoid:**
Maintain a denormalized `activeTaskCount` (`Number`, default `0`, `min: 0`, `max: 3`) on the `Employee` document and enforce both **eligibility** (`Active`, or `On Leave` when `startDate` is outside `[leaveStart, leaveEnd]` inclusive) and **capacity** (`< 3`) in a **single atomic conditional `findOneAndUpdate`** before inserting the task, paired with a compensating decrement if task persistence fails:

```js
// Step 1: Atomically verify eligibility + reserve 1 capacity slot on standalone mongod
const reservedEmployee = await Employee.findOneAndUpdate(
  {
    _id: assigneeId,
    activeTaskCount: { $lt: 3 },
    $or: [
      { status: 'Active' },
      {
        status: 'On Leave',
        $or: [
          { leaveStart: { $gt: normalizedStartDate } },
          { leaveEnd: { $lt: normalizedStartDate } },
        ],
      },
    ],
  },
  { $inc: { activeTaskCount: 1 } },
  { new: true }
);

if (!reservedEmployee) {
  // Inspect employee on the failure path only to return exact 404 vs 400 reason:
  // - Missing -> 404 "Employee not found"
  // - Inactive -> 400 "Cannot assign task to an Inactive employee."
  // - On Leave overlap -> 400 "Task start date falls within employee's leave period."
  // - activeTaskCount >= 3 -> 400 "Employee already has 3 active tasks. Please choose another employee."
  throw await buildAssignmentRejectionError(assigneeId, normalizedStartDate);
}

// Step 2: Generate collision-free taskId via atomic Counter document ($inc: { seq: 1 })
// Step 3: Create Task; compensate immediately on any write error
try {
  const seqDoc = await Counter.findOneAndUpdate(
    { _id: 'taskId' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  const taskId = `TSK-${String(seqDoc.seq).padStart(3, '0')}`;
  return await Task.create({
    ...validatedPayload,
    taskId,
    status: 'Todo',
    completedDate: null,
    assigneeSnapshot: toAssigneeSnapshot(reservedEmployee),
  });
} catch (err) {
  await Employee.updateOne(
    { _id: assigneeId, activeTaskCount: { $gt: 0 } },
    { $inc: { activeTaskCount: -1 } }
  );
  throw err;
}
```
MongoDB guarantees document-level atomicity on `Employee.findOneAndUpdate` even on a single standalone `mongod` node: when two concurrent requests arrive at `activeTaskCount: 2`, WiredTiger serializes the two `$inc` operations — the first transitions `2 -> 3` and succeeds; the second evaluates `activeTaskCount < 3` against `3`, returns `null`, and cleanly rejects with `400`.

**Warning signs:**
- `Task.countDocuments` appears inside `createTask` or `updateTask` as the sole capacity guard.
- `mongoose.startSession()` is called unconditionally without checking replica-set support.
- `TSK-xxx` uses `Task.countDocuments()` instead of a monotonic atomic `Counter` collection.

**Phase to address:**
Phase 1 (Backend Foundation, Schemas & Core Business-Rule Services) — verified by a `Promise.all` concurrency Supertest firing 5 simultaneous `POST /api/tasks` requests at an employee with 2 active tasks and asserting exactly 1 succeeds (`201`) and 4 fail (`400`), ending at `activeTaskCount === 3`.

---

### Pitfall 2: Task Reassignment, Terminal Status Release, & Active Task Deletion Slot Leaks

**What goes wrong:**
`Employee.activeTaskCount` drifts permanently out of sync with actual `Todo` + `In Progress` tasks ("phantom capacity leak" or negative count) across three lifecycle mutations:
1. **Reassigning an active task (`Employee A -> Employee B`) via `PUT /api/tasks/:id`:** Updating `task.assignee` without reserving a slot on Employee B allows B to exceed 3 active tasks (or receive a task while `Inactive` / `On Leave`), while forgetting to decrement Employee A permanently locks 1 of A's 3 slots. Conversely, decrementing A *before* confirming B has capacity leaks A's count if B's validation fails.
2. **Transitioning `Todo` / `In Progress` -> `Completed` or `Cancelled` via `PUT /api/tasks/:id/status`:** Two concurrent status-transition requests (e.g., double-click or parallel API calls sending `Completed` and `Cancelled`) both read `task.status === 'In Progress'` and **double-decrement** `activeTaskCount` by `-2`, or fail to lock the task from subsequent edits/transitions.
3. **Deleting an active task via `DELETE /api/tasks/:id`:** Calling `Task.findByIdAndDelete(id)` when the task is `Todo` or `In Progress` deletes the task document without decrementing `assignee.activeTaskCount`. After 3 deleted `Todo` tasks, the employee has `0` actual tasks in MongoDB yet `activeTaskCount === 3` — permanently unable to receive new tasks AND permanently blocked from employee deletion!

**Why it happens:**
Developers design `activeTaskCount` around the happy path (`POST /api/tasks` -> `Completed`) and overlook lateral mutations (assignee swaps, `Todo -> Cancelled`, `DELETE /api/tasks/:id`, and Create-then-Edit `startDate` changes on `On Leave` employees).

**How to avoid:**
Treat `activeTaskCount` as a strict conservation-of-slots ledger across **all four** task write operations:
1. **Edit Task (`PUT /api/tasks/:id`):**
   - Reject immediately (`400`) if the existing task is `Completed` or `Cancelled`, or if the request payload attempts to pass `status` or `completedDate`.
   - **Same assignee (`newAssigneeId === oldAssigneeId`):** Do **not** change `activeTaskCount`, but if `startDate` changed and the assignee is `On Leave`, re-verify `startDate` does not fall inside `[leaveStart, leaveEnd]` (closing the Create-outside-leave -> Edit-into-leave loophole). Do **not** re-block unchanged assignee status if an employee became `Inactive` after original assignment when only non-assignment fields (e.g., `description`, `priority`) are edited.
   - **Changed assignee (`newAssigneeId !== oldAssigneeId` on a `Todo` or `In Progress` task):**
     1. Atomically reserve 1 slot on **Employee B** (`findOneAndUpdate` checking Active / valid On-Leave + `activeTaskCount < 3`, `$inc: 1`). If this fails, abort with `400` — Employee A and the Task are untouched.
     2. Atomically update the Task with optimistic state guard:
        `Task.findOneAndUpdate({ _id: taskId, status: { $in: ['Todo', 'In Progress'] }, assignee: oldAssigneeId }, { $set: { ...updates, assignee: newAssigneeId, assigneeSnapshot: toAssigneeSnapshot(empB) } }, { new: true })`.
        If this returns `null` or throws (task was concurrently completed, cancelled, deleted, or reassigned), **rollback Employee B** (`Employee.updateOne({ _id: newAssigneeId, activeTaskCount: { $gt: 0 } }, { $inc: { activeTaskCount: -1 } })`) and abort.
     3. Atomically release 1 slot on **Employee A**:
        `Employee.updateOne({ _id: oldAssigneeId, activeTaskCount: { $gt: 0 } }, { $inc: { activeTaskCount: -1 } })`.
2. **Status Transition (`PUT /api/tasks/:id/status`):**
   - Enforce exact allowed transitions via an **atomic conditional task update** so only one concurrent caller can win:
     - `nextStatus === 'In Progress'` -> requires `{ status: 'Todo' }` (slot delta `0`).
     - `nextStatus === 'Completed'` -> requires `{ status: 'In Progress' }` (slot delta `-1`, sets `completedDate: new Date()` on server; note `Todo -> Completed` directly is **invalid** per spec).
     - `nextStatus === 'Cancelled'` -> requires `{ status: { $in: ['Todo', 'In Progress'] } }` (slot delta `-1`, `completedDate: null`).
   - Only when `Task.findOneAndUpdate({ _id, status: allowedCurrent }, ...)` returns a non-null document AND `nextStatus` is `'Completed'` or `'Cancelled'`, execute:
     `await Employee.updateOne({ _id: updatedTask.assignee, activeTaskCount: { $gt: 0 } }, { $inc: { activeTaskCount: -1 } })`.
3. **Delete Task (`DELETE /api/tasks/:id`):**
   - Execute `const deleted = await Task.findOneAndDelete({ _id: taskId })`.
   - If `deleted` had `status === 'Todo' || deleted.status === 'In Progress'`, release the slot:
     `await Employee.updateOne({ _id: deleted.assignee, activeTaskCount: { $gt: 0 } }, { $inc: { activeTaskCount: -1 } })`.
   - If `deleted` had `status === 'Completed' || deleted.status === 'Cancelled'`, do **not** decrement (its slot was already released when it entered terminal status).

**Warning signs:**
- `Task.findByIdAndDelete` in `taskController` with no status check or `Employee.updateOne`.
- Dashboard workload count (`Employee.activeTaskCount`) disagrees with `Task.countDocuments({ assignee, status: { $in: ['Todo', 'In Progress'] } })`.
- `activeTaskCount` ever becomes `-1` or `> 3` in automated tests.

**Phase to address:**
Phase 1 (Backend Task & Employee Services) — add an invariant helper in test suites asserting `employee.activeTaskCount === liveActiveTaskCount` after create, reassign, status transition, cancel, complete, and delete.

---

### Pitfall 3: Date & Timezone Off-By-One Traps (`UTC` Midnight vs `IST +05:30` / Negative Offsets)

**What goes wrong:**
1. **Tasks due TODAY are falsely flagged as Overdue:** `<input type="date">` submits `"2026-11-16"`. JavaScript's `new Date("2026-11-16")` parses ISO date-only strings as **UTC midnight** (`2026-11-16T00:00:00.000Z`). At 10:00 AM IST (`2026-11-16T04:30:00.000Z`) or 2:00 PM UTC, a naive check `new Date() > task.dueDate` evaluates `04:30Z > 00:00Z === true` — marking every task due *today* as **Overdue** across the UI, Dashboard, and CSV!
2. **Inclusive Leave Window (`leaveStart <= startDate <= leaveEnd`) off-by-one shift:** In IST (`UTC+05:30`), constructing a local midnight date `new Date(2026, 10, 16)` and calling `.toISOString()` serializes `"2026-11-15T18:30:00.000Z"` (**previous calendar day** in UTC!). Comparing a local-serialized `leaveStart` against a UTC-midnight `startDate` causes tasks starting on `leaveStart` to slip through or tasks starting the day before `leaveStart` to be falsely rejected.
3. **Local macOS (`+05:30`) vs Vercel Serverless (`UTC`) mismatch:** `const today = new Date(); today.setHours(0, 0, 0, 0)` produces `T18:30:00.000Z` (previous UTC day) on an IST developer laptop, `T00:00:00.000Z` on Vercel, and `T05:00:00.000Z` on a US East server (where `00:00Z < 05:00Z` again falsely marks today's tasks overdue!).
4. **Silent calendar rollover:** `new Date(Date.UTC(2026, 1, 31))` silently rolls `"2026-02-31"` over to `"2026-03-03"` without throwing an error.

**Why it happens:**
Business dates in HR/Task systems (`joiningDate`, `leaveStart`, `leaveEnd`, `startDate`, `dueDate`) are **calendar dates** (`YYYY-MM-DD`), not instants-in-time, whereas JavaScript `Date` and MongoDB `BSON Date` always store millisecond epoch timestamps.

**How to avoid:**
Enforce **strict `YYYY-MM-DD` -> UTC Midnight (`YYYY-MM-DDT00:00:00.000Z`) canonical normalization** end-to-end:
1. **Input Parsing & Validation (`dateUtils.js`):**
   - Accept `YYYY-MM-DD` strings (or strip ISO timestamps only after validating format; prefer strict `/^\d{4}-\d{2}-\d{2}$/` in Zod for all calendar-date inputs).
   - Parse via `const d = new Date(`${yyyyMmDd}T00:00:00.000Z`)` and verify `!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === yyyyMmDd` (rejects impossible dates like `2026-02-30` with `400`).
2. **Server "Today" Reference (`getTodayUtcMidnight()`):**
   - Derive today's `YYYY-MM-DD` string in a single explicit business timezone (`process.env.APP_TIMEZONE || 'Asia/Kolkata'`, documented in `README.md` Assumptions):
     ```js
     export function getTodayUtcMidnight(tz = process.env.APP_TIMEZONE || 'Asia/Kolkata') {
       const yyyyMmDd = new Intl.DateTimeFormat('en-CA', {
         timeZone: tz,
         year: 'numeric',
         month: '2-digit',
         day: '2-digit',
       }).format(new Date()); // 'en-CA' canonically formats as YYYY-MM-DD
       return new Date(`${yyyyMmDd}T00:00:00.000Z`);
     }
     ```
3. **Single Shared Overdue & Range Semantics:**
   - **Overdue rule:** *"today is later than Due Date and status is not Completed or Cancelled."*
     - MongoDB filter: `{ dueDate: { $lt: todayUtcMidnight }, status: { $nin: ['Completed', 'Cancelled'] } }`
     - In-memory serializer (`computeIsOverdue(task, todayUtcMidnight)`):
       `task.status !== 'Completed' && task.status !== 'Cancelled' && task.dueDate.getTime() < todayUtcMidnight.getTime()`
     - Task due today (`2026-11-16T00:00Z < 2026-11-16T00:00Z`) is `false` (not overdue); task due yesterday (`2026-11-15T00:00Z < 2026-11-16T00:00Z`) is `true` (overdue).
   - **Inclusive leave check:** `startDate.getTime() >= leaveStart.getTime() && startDate.getTime() <= leaveEnd.getTime()`.
   - **Due >= Start check:** `dueDate.getTime() >= startDate.getTime()` (same-day start and due date is valid).
4. **Frontend Display & Form Binding:**
   - Bind `<input type="date">` directly to `YYYY-MM-DD` strings (`isoString.slice(0, 10)`), **never** `new Date(local).toISOString()`.
   - Format calendar dates in React and CSV with `timeZone: 'UTC'` (`new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })`) so `2026-11-16T00:00:00.000Z` always renders `16 Nov 2026` in every browser timezone worldwide. (`completedDate` and `createdAt` remain true UTC instants).

**Warning signs:**
- `new Date().setHours(0, 0, 0, 0)` anywhere in backend or frontend code.
- Overdue count on Dashboard differs from rows badged `(Overdue)` in Task List or `Overdue = Yes` in CSV export.
- Assigning a task with `startDate === leaveStart` or `startDate === leaveEnd` passes unexpectedly in tests.

**Phase to address:**
Phase 1 (Shared Date Utility & Backend Validation) and Phase 3/4 (Frontend Date Formatting & Forms).

---

### Pitfall 4: Express Static-vs-Parametric Route Collision (`GET /api/tasks/export` Shadowed by `/:id`)

**What goes wrong:**
Calling `GET /api/tasks/export.csv` (or `GET /api/tasks/export`) returns `400 Invalid Task ID` or `500 CastError: Cast to ObjectId failed for value "export.csv" (type string) at path "_id" for model "Task"` instead of streaming the CSV file. The exact same bug hits `GET /api/employees/options` (or `/active`) if mounted after `GET /api/employees/:id`.

**Why it happens:**
Express matches routes top-to-bottom in registration order. If `router.get('/:id', getTaskById)` is registered **before** `router.get('/export', exportTasksCsv)` (or `/export.csv`), `:id` greedily captures `"export"` / `"export.csv"` as a parameter and never reaches the CSV handler.

**How to avoid:**
1. **Strict Route Registration Order:** In every Express router (`taskRoutes.js`, `employeeRoutes.js`), mount all static/collection sub-routes **above** any `/:id` parameterized routes:
   ```js
   // taskRoutes.js — STATIC ROUTES FIRST
   router.get('/', listTasks);
   router.get('/export', exportTasksCsv);       // alias /api/tasks/export
   router.get('/export.csv', exportTasksCsv);   // alias /api/tasks/export.csv
   router.post('/', createTask);

   // PARAMETERIZED ROUTES SECOND (with validateObjectId middleware)
   router.get('/:id', validateObjectId('id'), getTaskById);
   router.put('/:id/status', validateObjectId('id'), updateTaskStatus);
   router.put('/:id', validateObjectId('id'), updateTask);
   router.delete('/:id', validateObjectId('id'), deleteTask);
   ```
2. **Validate `:id` Explicitly:** Add a reusable `validateObjectId('id')` middleware (`mongoose.isValidObjectId(req.params[param])`) that returns a clean `400` or `404` JSON error rather than letting raw Mongoose `CastError` bubble up as a `500`.

**Warning signs:**
- Adding a new GET endpoint under `/api/tasks/...` or `/api/employees/...` at the bottom of the router file.
- Unhandled `CastError` stack traces in server logs during API testing.

**Phase to address:**
Phase 1 / Phase 2 (API Router Scaffolding & CSV Export Endpoint) — include an explicit integration test hitting `GET /api/tasks/export?...` and asserting `200` + `Content-Type: text/csv`.

---

### Pitfall 5: Employee Lifecycle Desync — Stale Leave Dates, Deleted-Employee `null` Populate Crashes, & `assigneeSnapshot` Drift

**What goes wrong:**
Three subtle bugs break Employee <-> Task relational integrity over time:
1. **Stale Leave Dates after Returning from Leave:** An employee is edited from `On Leave` (`leaveStart: 2026-11-20`, `leaveEnd: 2026-11-25`) back to `Active` (or `Inactive`). The frontend hides the leave fields and omits them from `PUT /api/employees/:id`. Mongoose keeps the old `leaveStart` and `leaveEnd` values in MongoDB, violating *"Leave Start and Leave End (only when On Leave)"* and rendering ghost leave ranges on the Employee View page.
2. **Null-Dereference Crash & Broken Search after Employee Deletion:** Once an employee with zero active tasks (`activeTaskCount === 0`, only `Completed`/`Cancelled` tasks) is deleted, `Task.find().populate('assignee')` sets `task.assignee = null` on all their historical tasks. Code accessing `task.assignee.fullName` crashes with `TypeError`, and `$lookup`-based search by employee name stops finding historical tasks for that former employee. Furthermore, a race between `DELETE /api/employees/:id` and concurrent `POST /api/tasks` can orphan a brand-new `Todo` task on a deleted employee if deletion isn't atomic.
3. **`assigneeSnapshot` Stale Drift on Employee Profile Edits:** Updating an employee's `fullName`, `email`, `department`, or `role` via `PUT /api/employees/:id` leaves old `assigneeSnapshot` values on existing tasks — causing server-side search on `assigneeSnapshot.fullName` to miss the employee's new name and leaving outdated pre-edit details if the employee is later deleted.

**Why it happens:**
MongoDB has no foreign-key `ON DELETE RESTRICT` or `ON UPDATE CASCADE`; partial `PUT` updates in Mongoose leave omitted fields untouched unless explicitly `$unset`.

**How to avoid:**
1. **Clear Leave Fields When `status !== 'On Leave'`:**
   - In `employeeService` (`createEmployee` and `updateEmployee`), if `status === 'On Leave'`, require both `leaveStart` and `leaveEnd` (`leaveEnd >= leaveStart`). If `status === 'Active'` or `status === 'Inactive'`, explicitly force `{ $set: { ...fields, leaveStart: null, leaveEnd: null } }` (or `$unset: { leaveStart: 1, leaveEnd: 1 }`) even if the client sent old values.
2. **Atomic Employee Deletion Guard + `assigneeSnapshot` Fallback:**
   - Check `Task.exists({ assignee: id, status: { $in: ['Todo', 'In Progress'] } })` AND execute conditional atomic delete `Employee.findOneAndDelete({ _id: id, activeTaskCount: 0 })` (returning `400` / `409` with clear message `"Cannot delete employee while they have active (Todo or In Progress) tasks"` when active tasks exist, or `404` if employee doesn't exist). Because both task assignment (`$inc: 1`) and deletion (`activeTaskCount: 0`) lock the same `Employee` document, concurrent assign-during-delete races are impossible.
   - Store `assigneeSnapshot: { employeeId, fullName, email, department, role }` on every `Task`. In API serializers, UI components, and CSV export, always resolve display info via `const displayAssignee = task.assignee ?? task.assigneeSnapshot` (adding a subtle `Former Employee` indicator in UI when `task.assignee === null`).
   - Run server-side task search (`?search=...`) against `{ $or: [{ title: safeRegex }, { 'assigneeSnapshot.fullName': safeRegex }] }` so historical tasks of deleted employees remain searchable without `$lookup` overhead.
3. **Sync `assigneeSnapshot` on Employee Updates (Without Touching `Task.department`):**
   - When `PUT /api/employees/:id` modifies `employeeId`, `fullName`, `email`, `department`, or `role`, propagate the refreshed snapshot across tasks referencing that employee:
     `await Task.updateMany({ assignee: updatedEmployee._id }, { $set: { assigneeSnapshot: toAssigneeSnapshot(updatedEmployee) } })`.
   - Note: Do **not** overwrite `task.department` (the Task entity has its own `department` field selected on the Task form, distinct from `assigneeSnapshot.department`).

**Warning signs:**
- `task.assignee.fullName` accessed without null-coalescing (`task.assignee?.fullName ?? task.assigneeSnapshot.fullName`).
- Switching an employee from `On Leave` -> `Active` in Edit Employee form still returns `leaveStart` in `GET /api/employees/:id`.

**Phase to address:**
Phase 1 (Employee & Task Lifecycle Services) and Phase 3/4 (Employee & Task Detail/List UI).

---

### Pitfall 6: JSX Inline Style Ban Violation (`style={{ ... }}`) on Dynamic Rings, Progress Bars, Charts, & Menus

**What goes wrong:**
Evaluators grep the frontend codebase for `style={` and deduct marks under the assignment's explicit **Negative Points** rubric: *"No componentization, inline styles, bad naming"*. Even a single `style={{ width: `${pct}%` }}` on a workload bar, `style={{ strokeDashoffset }}` on an Apple Activity ring, `style={{ top, left }}` on a row action menu, or third-party chart component injecting inline DOM styles triggers a rubric penalty.

**Why it happens:**
React developers habitually reach for `style={{ ... }}` whenever a visual property depends on data (`0/3` to `3/3` workload capacity, chart bar heights, skeleton widths, or dropdown positioning), and libraries like Recharts emit inline `style` attributes internally and encourage `contentStyle={{ ... }}` props.

**How to avoid:**
1. **Zero-Tolerance Rule + Automated Lint/Grep Gate:**
   - Ban `style` props across all `.jsx`/`.tsx` files via ESLint (`react/forbid-dom-props: ["error", { "forbid": ["style"] }]` and `react/forbid-component-props: ["error", { "forbid": ["style"] }]`) and verify `grep -rn "style=" client/src/` returns **0 matches** before completion.
2. **Apple Activity Rings via Native SVG Attributes + CSS Modules (Zero Inline Styles):**
   - On `<circle>`, `strokeDasharray={circumference}` and `strokeDashoffset={dashOffset}` are **native SVG XML attributes**, NOT HTML `style` attributes! Pair them with semantic CSS Module classes (`styles.ringTrack`, `styles.ringProgress`, `styles.load0`, `styles.load1`, `styles.load2`, `styles.load3`) that control stroke color (`--color-accent-green`, `--color-accent-orange`, `--color-accent-red`) and `transition: stroke-dashoffset 450ms cubic-bezier(0.22, 1, 0.36, 1)`.
3. **Workload Bars &Discrete Ratios via `data-*` Selectors or Native `<progress>`:**
   - Since employee active task capacity is strictly discrete (`0`, `1`, `2`, `3`), style workload bars cleanly in CSS Modules using `[data-count="0"] { width: 0%; }`, `[data-count="1"] { width: 33.333%; }`, `[data-count="2"] { width: 66.667%; }`, `[data-count="3"] { width: 100%; }`.
   - For general dashboard distribution visuals (e.g., Tasks by Status: Todo / In Progress / Completed / Cancelled / Overdue), build crisp custom **SVG horizontal segmented bars or donut rings** using SVG `width` / `x` / `strokeDasharray` attributes + CSS Module classes instead of pulling in Recharts (which injects inline `style` tags into rendered DOM and adds ~150KB gzipped bloat).
4. **Action Menus & Modals without Inline Coordinates:**
   - Anchor row kebab menus (`View / Edit / Delete`) inside `position: relative` cell wrappers with `position: absolute; right: 0;` CSS Module classes (plus upward-flip class on the last 2 table rows if needed), and use semantic `<dialog>` or CSS fixed backdrop overlays for confirmation modals.

**Warning signs:**
- Installing `recharts` or `framer-motion` (both heavily mutate inline `element.style`).
- Any occurrence of `style={{` in `client/src/`.

**Phase to address:**
Phase 3 & Phase 4 (Design System Foundation, Dashboard & CRUD Screens) — enforce ESLint rule in Phase 3 scaffolding before any UI component is written.

---

### Pitfall 7: Normal Update Endpoint Loopholes, Alphabetical Priority Sort, & Partial-Page CSV Export (Rubric Traps)

**What goes wrong:**
Three high-probability backend grading tests fail silently if overlooked:
1. **Status or `completedDate` accepted via `POST /api/tasks` or `PUT /api/tasks/:id`:** The PDF explicitly lists *"status editable through the normal update API"* under **Negative Points** and states *"New tasks start as Todo and status is changed only through PUT /api/tasks/:id/status"* and *"Completed Date is set by the backend when a task becomes Completed, never taken from the frontend."* If `PUT /api/tasks/:id` uses `Task.findByIdAndUpdate(id, req.body)` (or silently ignores `status` with `200 OK` when an evaluator tests `PUT /api/tasks/:id` with `{ "status": "Completed" }`), it either mutates status illegally or misleads API graders.
2. **Lexicographical (Alphabetical) Priority Sorting:** Calling `.sort({ priority: -1 })` in MongoDB sorts strings alphabetically (`Medium` -> `Low` -> `High` -> `Critical` descending; `Critical` -> `High` -> `Low` -> `Medium` ascending) instead of *"priority by importance"* (`Critical > High > Medium > Low`).
3. **CSV Export Returning Only Current Page (`limit=10`):** Reusing the paginated list handler for CSV export downloads only 10 rows instead of *"all tasks matching the current filters (not only the visible page)"*, or breaks CSV column alignment when a task description contains commas `,` or newlines `\n`.

**Why it happens:**
Standard CRUD boilerplate passes `req.body` into Mongoose, sorts string enums directly, and shares pagination defaults across query helpers.

**How to avoid:**
1. **Explicitly Reject `status` and `completedDate` on Create/Update:**
   - On `POST /api/tasks`: reject with `400 Bad Request` if `req.body.status !== undefined && req.body.status !== 'Todo'` (or reject any `status` / `completedDate` field in `POST` and `PUT /api/tasks/:id` with a clear message: `"Task status can only be changed via PUT /api/tasks/:id/status"` and `"completedDate is managed automatically by the server"`), and ensure frontend forms omit both fields.
2. **Numeric `priorityRank` for Importance Sorting:**
   - Store an indexed `priorityRank` field (`Low: 1, Medium: 2, High: 3, Critical: 4`) derived automatically in the service/model whenever `priority` is set or updated.
   - Sort `priority` queries by `{ priorityRank: direction, createdAt: -1, _id: 1 }` (deterministic tie-breaker prevents duplicate/missing items across pages!), and sort `title` queries with `.collation({ locale: 'en', strength: 2 })` for natural case-insensitive alphabetical ordering.
3. **Filter-Shared, Unpaginated, RFC-4180-Compliant Streaming CSV Export:**
   - Extract `buildTaskFilterQuery(query)` + `buildTaskSortSpec(query)` and share them across `GET /api/tasks` (which adds `.skip().limit()`) and `GET /api/tasks/export` (which streams `Task.find(filter).sort(sortSpec).cursor()` with **no** `skip`/`limit`).
   - Escape every CSV cell per RFC 4180 (wrap in `"..."` and double internal quotes `""` when cell contains `,`, `"`, `\r`, or `\n`; prefix formula-injection characters `=`, `+`, `-`, `@` on untrusted text only if appropriate or safely quote), include the server-computed `Overdue` (`Yes`/`No`) column, and send `Content-Type: text/csv; charset=utf-8` + UTF-8 BOM `\uFEFF` so Excel opens UTF-8 names cleanly.

**Warning signs:**
- `sortBy=priority&sortOrder=desc` puts `Medium` above `Critical`.
- `PUT /api/tasks/:id` Zod schema uses `.strip()` silently on `status` instead of returning `400` when someone explicitly attempts to change `status` on the edit endpoint.
- Exporting CSV on page 2 of 3 (`?status=Todo&page=2`) downloads only 5 rows instead of all 23 matching rows.

**Phase to address:**
Phase 2 (Server-Side Search, Composable Filters, Importance Sorting, Dashboard & CSV Export).

---

### Pitfall 8: URL Query Desynchronization, Unescaped Search Regex (`500` Crash), & Dual-Vercel Deployment Traps

**What goes wrong:**
1. **URL State Drift & Empty-Page Trap:** Mirroring `useSearchParams` into React `useState` causes back/forward navigation bugs or infinite `useEffect` loops. Changing `status` or `priority` while on `page=3` without resetting `page=1` sends `?status=Completed&page=3` and renders an empty table despite matching records existing on page 1.
2. **Regex Crash (`500`) on Special Characters:** Typing `C++`, `(urgent)`, or `[QA]` into the search box passes raw user input to `new RegExp(search, 'i')`, throwing `SyntaxError: Invalid regular expression` (`500 Internal Server Error`).
3. **Live Vercel Deployment Failures:**
   - Refreshing `/tasks?status=In%20Progress&priority=High&page=2` (an explicit assignment test!) returns Vercel's `404: NOT_FOUND` because `client/vercel.json` lacks SPA fallback rewrites.
   - Serverless Express (`server/api/index.js`) times out with `MongooseError: Operation buffering timed out after 10000ms` because `connectDB()` was only called inside `if (require.main === module) app.listen(...)` instead of being cached on `globalThis` and awaited per request before Express handlers run.

**Why it happens:**
Local Vite dev server (`historyApiFallback`) and persistent local Node processes mask SPA routing and serverless connection-lifecycle bugs until post-deployment verification.

**How to avoid:**
1. **URL as Single Source of Truth:** Derive `search`, `department`, `priority`, `status`, `dueFrom`, `dueTo`, `sortBy`, `sortOrder`, and `page` directly from `useSearchParams()`. Centralize updates in `updateQueryParams(patch, { resetPage = true })` so every filter/search/sort mutation atomically resets `page` to `1` (and auto-clamps `page` if deleting the last row on page $N$ leaves `items.length === 0 && total > 0`).
2. **Escape All Search Regex Input:** Always sanitize via `const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` before building `$regex`.
3. **Serverless-Ready DB Middleware + `vercel.json` Configs:**
   - Cache `globalThis.__mongooseConn` promise and attach `app.use(async (req, res, next) => { await connectDB(); next(); })` before API routes so both local `server.js` and Vercel `api/index.js` await a warm connection.
   - Include `client/vercel.json` with `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }` and normalize `CORS_ORIGIN` by stripping trailing slashes (`origin.replace(/\/+$/, '')`).

**Warning signs:**
- `const [statusFilter, setStatusFilter] = useState('')` alongside `useSearchParams()` in list pages.
- Searching `"C++"` on Employees or Tasks returns `500`.
- `mongoose.connect()` only exists inside `server.js` startup script rather than Express request lifecycle / cached connector.

**Phase to address:**
Phase 2 (Regex & Query Handling), Phase 4 (URL-Synchronized List Pages), and Phase 5 (Deployment & README Hardening).

---

## Technical Debt Patterns

Shortcuts that seem reasonable during rapid MERN builds but create rubric penalties or data corruption bugs.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Computing `activeTaskCount` only on read (`$lookup` / `countDocuments`) without atomic write gate on `Employee` | No counter maintenance on delete/reassign | Fails README Q6 concurrency test on standalone `mongod`; two parallel requests assign a 4th active task | **Never** (violates core assignment test) |
| Relying on Mongoose `runValidators: true` with `this.startDate` inside `findOneAndUpdate` | Avoids writing service-layer date validation | `this` refers to `Query` (not document) during update; `this.startDate` is `undefined`, either rejecting valid partial edits or allowing `dueDate < startDate` | **Never** — validate merged state in Zod + service layer |
| Fetching `GET /api/employees?limit=1000` on Employee List page and slicing in React | Quick client-side search/filter | Direct rubric **Negative Point**: *"Fetching all records and filtering / paginating in React"* | **Never** on List pages (use a dedicated lightweight `/api/employees/options` endpoint **only** for the Task form's assignee picker) |
| Using `style={{ width: `${pct}%` }}` for workload bars | Saves 15 lines of CSS | Direct rubric **Negative Point**: *"inline styles"* | **Never** — use SVG attributes or `data-count` CSS Module selectors |
| Leaving seed/mock fallback arrays inside React components or Express controllers | UI renders data when DB is empty | Direct rubric **Negative Point**: *"Hardcoded mock data"* | **Never** — keep seed data strictly isolated in standalone `server/scripts/seed.js` |

## Integration Gotchas

Common mistakes across Mongoose, Express, Vite/React, and Vercel boundaries.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **MongoDB Unique Indexes (`employeeId`, `email`)** | Assuming pre-save `Employee.findOne({ email })` prevents duplicates; raw `E11000` throws `500` under race or case variation (`Rahul@x.com` vs `rahul@x.com`) | Normalize `email` (`.trim().toLowerCase()`) and `employeeId` (`.trim()`) in Zod + schema, call `Employee.init()` before tests, and translate `err.code === 11000` in global error middleware to `409 Conflict` with exact field name |
| **TanStack Query Cache Invalidation** | Mutating task status (`PUT /api/tasks/:id/status`) invalidates `['tasks']` only, leaving Dashboard workload and Employee Detail active counts stale | On every Task create/edit/status/delete mutation, invalidate `['tasks']`, `['dashboard']`, and `['employees']` query keys together |
| **Assignee Picker vs Paginated Employee List** | Populating Add/Edit Task `Assigned Employee` dropdown from paginated `GET /api/employees` (only shows first 10 employees!) | Expose `GET /api/employees/options` (mounted **before** `/:id`) returning minimal assignable metadata (`_id, employeeId, fullName, department, status, activeTaskCount, leaveStart, leaveEnd`) sorted by name |
| **CORS Between Deployed Frontend & Backend** | Hardcoding `http://localhost:5173` or failing when `CORS_ORIGIN` env var has a trailing `/` | Support comma-separated origins in `CORS_ORIGIN`, strip trailing slashes on comparison, and expose `Content-Disposition` header (`exposedHeaders: ['Content-Disposition']`) so frontend CSV download can read the server filename |
| **`mongodb-memory-server` in Vitest** | Spinning up a replica set in tests while local dev uses standalone `mongod` | Run `MongoMemoryServer.create()` (default standalone instance, NOT `MongoMemoryReplSet`) so tests verify standalone `mongod` compatibility identically to local evaluation |

## Performance Traps

Patterns that work with 5 seed records but degrade noticeably at realistic dataset sizes.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **$lookup + $unwind on `employees` for every `GET /api/tasks` search** | Slow pagination and complex count pipelines; misses deleted employees | Query `assigneeSnapshot.fullName` + `title` directly on indexed `tasks` collection; `.populate('assignee')` only the 10 paginated rows | > 1,000 tasks |
| **N+1 `Task.countDocuments` per employee on Dashboard API** | Dashboard runs $1 + N$ queries (1 per employee) to build Employee Workload table | Use `Employee.activeTaskCount` or a single `$group` aggregation on `tasks` (`status: { $in: ['Todo', 'In Progress'] }`) joined/projected cleanly in one `$facet` / parallel `Promise.all` batch | > 50 employees |
| **Buffering entire CSV string in Node heap before `res.send()`** | High memory spike on export | Stream rows incrementally via `Task.find(filter).sort(sort).lean().cursor()` writing chunks directly to `res.write()` | > 10,000 tasks |
| **Un-debounced URL `searchParams` updates on every keystroke** | Fires an API request per character and floods browser history stack (`Back` button steps character-by-character!) | Debounce search sync by ~300ms and use `{ replace: true }` for typing updates (while using push navigation for discrete filter/page clicks) | Immediate UX degradation |

## Security Mistakes

Domain-specific security and data-integrity issues beyond auth (since login is explicitly out of scope).

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Mass Assignment on `POST`/`PUT /api/tasks`** | Attacker/tester sends `{ "status": "Completed", "completedDate": "2020-01-01", "taskId": "TSK-999" }` bypassing state machine | Strict Zod schemas per endpoint; explicitly reject `status` and `completedDate` on normal create/edit endpoints with `400` and strip server-owned fields (`taskId`, `assigneeSnapshot`) |
| **NoSQL Operator Injection in Query Params** | Express `qs` parses `?status[$ne]=Cancelled` into `{ $ne: 'Cancelled' }`, bypassing filter validation | Validate all `req.query` parameters through Zod (`z.string()`, enum checks) so non-string objects return `400 Bad Request` |
| **ReDoS / Unescaped Regex in `search` Param** | Crafted regex causes catastrophic backtracking or crashes Node with `SyntaxError` | Cap `search` length (`max(100)`) and escape all regex metacharacters before `$regex` execution |
| **CSV Formula Injection** | Task title starting with `=HYPERLINK(...)` or `=CMD|...` executes formulas when opened in Excel | Prefix cells starting with `=`, `+`, `-`, `@`, `\t`, `\r` (when not plain numbers/dates) or safely sanitize inside the RFC-4180 cell serializer |
| **Committed `.env` or Atlas Connection Strings** | Direct rubric deduction (*"committed passwords or secrets"*) + credential leak | Verify `.env` is in root, `client/`, and `server/` `.gitignore` rules before initial code commit; ship documented `.env.example` files only |

## UX Pitfalls

Common user-experience mistakes in rule-heavy HR & Task management interfaces.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **Showing all 4 statuses in the Task Status dropdown** | User selects `Todo -> Completed` or `Completed -> In Progress` and hits avoidable errors; violates rubric *"Status dropdown shows only the valid next statuses"* | Compute `getValidNextStatuses(task.status)` (`Todo -> ['In Progress', 'Cancelled']`, `In Progress -> ['Completed', 'Cancelled']`, `Completed/Cancelled -> []`); render a locked status pill (no dropdown) on terminal tasks |
| **Generic `"Something went wrong"` toast on `400`/`409` errors** | User has no idea *why* assignment or deletion failed (3 active tasks? leave overlap? inactive? duplicate email?) | Return structured `{ success: false, error: { code, message, fieldErrors } }` from Express and surface the exact human-friendly `error.message` both inline on forms (like PDF Page 3 banner) AND in toast notifications |
| **Allowing Edit button on `Completed` / `Cancelled` tasks without clear visual lock** | User fills out an edit form only to get rejected on submit | Disable/hide `Edit` action on `Completed`/`Cancelled` rows with a clear tooltip (`"Completed tasks are locked"`), and if user navigates directly to `/tasks/:id/edit` via URL, show a read-only locked banner with link to View page (while still enforcing `400` on backend!) |
| **Blind Assignee Selection on Add/Edit Task Form** | User repeatedly guesses which employees have $<3$ active tasks or aren't on leave | Display live context right in the Employee option label (e.g., `Rahul Sharma — Development (2/3 active)` or `Priya Patil — On Leave (20 Nov–25 Nov)`), warn proactively on the client, and still enforce deterministically on the backend |
| **Layout Shift & Blank Flash During Server Filtering/Pagination** | Table collapses to height `0` on every filter click | Keep previous data placeholder (`placeholderData: keepPreviousData` in TanStack Query) with subtle loading indicator + Apple-grade skeleton rows on initial load |

## "Looks Done But Isn't" Checklist

Critical verification gates that appear complete in casual click-testing but fail strict rubric grading.

- [ ] **Concurrent 4th Task Assignment:** Firing 2+ simultaneous `POST /api/tasks` requests when an employee has `2` active tasks rejects the 4th task on standalone `mongod` without replica-set transaction errors.
- [ ] **Active Task Deletion Slot Release:** Creating 3 `Todo` tasks for Employee X, deleting 1 `Todo` task via `DELETE /api/tasks/:id`, and creating a new task for Employee X **succeeds** (proving `activeTaskCount` decremented from `3 -> 2`).
- [ ] **Active Task Reassignment Slot Transfer:** Reassigning an `In Progress` task from Employee A (`3/3`) to Employee B (`2/3`) leaves A at `2/3` and B at `3/3`; attempting to reassign to Employee C (`3/3`) fails with `400` and leaves A untouched at `3/3`.
- [ ] **Inclusive Leave Boundaries:** For an `On Leave` employee with `leaveStart = 2026-11-20` and `leaveEnd = 2026-11-25`, tasks with `startDate = 2026-11-20` and `startDate = 2026-11-25` are **rejected (`400`)**, while `startDate = 2026-11-19` and `startDate = 2026-11-26` are **accepted (`201`)**.
- [ ] **Leave Fields Cleared on Return:** Switching an `On Leave` employee back to `Active` clears `leaveStart` and `leaveEnd` to `null` in MongoDB and API responses.
- [ ] **Normal Update API Blocks Status & CompletedDate:** Sending `PUT /api/tasks/:id` with `{ "status": "Completed" }` or `{ "completedDate": "2026-11-16" }` returns `400 Bad Request` and does **not** mutate task status or completion timestamp.
- [ ] **Overdue Consistency Across All 4 Surfaces:** A task due *today* is **not** overdue; a `Todo`/`In Progress` task due *yesterday* shows as overdue identically in `GET /api/tasks` (list), `GET /api/tasks/:id` (detail), `GET /api/dashboard` (count), and `GET /api/tasks/export` (CSV); `Completed`/`Cancelled` tasks with past due dates are **never** marked overdue.
- [ ] **Deleted Employee Historical Preservation:** Deleting an employee who holds only `Completed`/`Cancelled` tasks succeeds (`200`), and viewing, searching (by that employee's name), or CSV-exporting those old tasks still renders the employee's full name, ID, and department without crashing.
- [ ] **Full-Dataset Filtered CSV Export:** On `/tasks?priority=High&page=2`, clicking **Export CSV** downloads **all** `priority=High` tasks across all pages (not just page 2) without triggering a `:id` `CastError`.
- [ ] **Zero Inline Styles:** `grep -rn "style=" client/src/` returns zero matches across the entire React codebase.
- [ ] **Deep-Link Refresh Persistence:** Copying `/tasks?status=In%20Progress&priority=High&sortBy=priority&sortOrder=desc&page=2` into a fresh browser tab (both locally and on deployed Vercel) renders the exact filtered, sorted, paginated view.

## Recovery Strategies

When pitfalls occur despite prevention, how to diagnose and recover cleanly.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| `Employee.activeTaskCount` drift discovered during development/seeding | LOW | Run an idempotent reconciliation utility (`reconcileActiveTaskCounts()`) that aggregates live `{ status: { $in: ['Todo', 'In Progress'] } }` counts per `assignee` from `tasks` and bulk-writes exact `activeTaskCount` values onto `employees`; fix the leaking controller path immediately |
| Timezone off-by-one timestamps saved with non-midnight hours (`T18:30:00.000Z`) | LOW | Normalize existing documents via one-time migration script (`YYYY-MM-DD` extracted in `Asia/Kolkata` -> `T00:00:00.000Z`) and re-seed local/demo DB |
| Inline `style={{ ... }}` introduced by third-party UI/chart package | MEDIUM | Remove third-party chart component and replace with pure SVG + CSS Module component; enable ESLint `forbid-dom-props` / `forbid-component-props` so CI catches regressions immediately |
| Committed `.env` file in git history | HIGH | Rotate MongoDB Atlas DB user password immediately, rewrite git history (`git filter-repo` / interactive rebase before submission), and verify `.gitignore` coverage |

## Pitfall-to-Phase Mapping

How roadmap phases should sequence and verify prevention of every pitfall.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| **1. Concurrency race on 4th task & standalone `mongod` compatibility** | Phase 1: Backend Core Models & Business-Rule Services | Supertest `Promise.all` concurrency test against standalone `MongoMemoryServer` + local `mongod` smoke test |
| **2. Reassignment, terminal status release, & active task delete leaks** | Phase 1: Backend Core Models & Business-Rule Services | Automated lifecycle test matrix verifying `activeTaskCount` conservation across create, reassign, complete, cancel, and delete |
| **3. Date & timezone off-by-one (`UTC` vs `IST +05:30`)** | Phase 1: Shared Date Utils & Phase 2: Query/Dashboard/CSV | Unit tests with frozen clocks (`vi.setSystemTime`) at `00:05 IST`, `12:00 IST`, and `23:55 IST` verifying today's due date is not overdue and inclusive leave edges hold |
| **4. Express `/export` vs `/:id` route collision** | Phase 2: Search, Filter, Sort, Dashboard & CSV APIs | Supertest `GET /api/tasks/export` and `GET /api/tasks/export.csv` returning `200 text/csv` |
| **5. Employee leave clearing, atomic delete guard, & `assigneeSnapshot` sync** | Phase 1: Employee/Task Services & Phase 3/4: UI Views | Integration test: edit employee `On Leave -> Active` (assert `leaveStart === null`), edit employee name (assert task snapshot updated), delete employee (assert old task view + search + CSV still show employee details) |
| **6. JSX inline style ban (`style={{ ... }}`)** | Phase 3: Apple HIG Design System & Phase 4: Dashboard/Screens | ESLint `forbid-dom-props` + `grep -rn "style=" client/src/` returning exit code 1 (zero matches) |
| **7. Normal update status/date loophole, priority importance sort, & full CSV** | Phase 1 & Phase 2: Task APIs, Sorting & Export | Supertest asserting `400` on `PUT /api/tasks/:id` with `status`, asserting `Critical > High > Medium > Low` order, and asserting CSV row count equals `total` across multi-page filter |
| **8. URL query sync, regex escaping, & dual-Vercel deployment** | Phase 4: Frontend SPA Routing & Phase 5: Deployment/Docs | Supertest searching `"C++ (urgent)"` -> `200`, Playwright/browser deep-link reload test, and `vercel.json` rewrite + cached DB connector check |

## Sources

- Project Specification: `Roots_MERN_Intern_Assignment.pdf` (Pages 1–4: Entity definitions, 8 backend business rules, Must Have / Negative Points rubric, and 6 mandatory README architecture questions)
- Project Context: `.planning/PROJECT.md` (Standalone `mongod` + Atlas dual-target constraint, `assigneeSnapshot` decision, Apple HIG Vanilla CSS Modules architecture)
- MongoDB Server Manual: *Atomicity and Transactions* — single-document atomic write guarantees (`findOneAndUpdate` + `$inc` predicate serialization in WiredTiger without replica-set multi-document transactions)
- Mongoose v8 Documentation: *Validation (`findOneAndUpdate` query validator `this` context limitations)* and *Populate (retaining fallback snapshots when referenced documents are deleted)*
- Express Routing Guide & RFC 4180 (*Common Format and MIME Type for Comma-Separated Values Files*)

---
*Pitfalls research for: Roots Employee & Task Management System*
*Researched: 2026-11-16*
