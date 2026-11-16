# Roots Workspace — Employee & Task Management System

**Author:** Prathmesh Karale  
**Technical Assignment:** Roots Media Marketing — MERN Stack Developer Intern  
**Tech Stack:** MongoDB + Mongoose 8 · Express 5 · React 19 (Vite 6) · Node.js 24 · Zod · TanStack Query v5 · Vanilla CSS Modules (Apple HIG Design System)

---

## Overview

Roots Workspace is a full-stack Employee & Task Management System built for five organizational departments (`Development`, `Design`, `QA`, `HR`, `Sales`). Every business invariant in the specification is enforced deterministically on the backend—including under concurrent HTTP requests on standalone local MongoDB—and surfaced through an Apple Human Interface Guidelines (macOS Sequoia / iPadOS 18) responsive interface with Light/Dark/System themes, Activity-ring workload gauges, and URL-persisted query state.

---

## Quick Start (Local Development)

### Prerequisites
- **Node.js** `>= 22.12` (tested on `v24.5.0`)
- **MongoDB** running locally on `127.0.0.1:27017` (standalone `mongod` — no replica set required)

### 1. Backend Setup (`server/`)
```bash
cd server
cp .env.example .env
npm install

# Optional: populate realistic demo employees & tasks across all 5 departments
npm run seed

# Start Express 5 API server on http://localhost:5001
npm run dev
```

### 2. Frontend Setup (`client/`)
```bash
cd client
cp .env.example .env
npm install

# Start Vite dev server on http://localhost:5173 (proxies /api -> http://127.0.0.1:5001)
npm run dev
```

### 3. Run Automated Backend Rule & Concurrency Tests
```bash
cd server
npm test
```
Runs 17 end-to-end integration tests (`Vitest` + `Supertest` + `mongodb-memory-server`) covering every business rule, 5 inclusive leave-window date boundaries, `Promise.all` concurrent 4th-task race protection, server search/filter/importance-sort/pagination, overdue consistency, dashboard aggregation, and RFC-4180 CSV streaming.

---

## Environment Variables

### `server/.env.example`
| Variable | Default | Description |
|---|---|---|
| `PORT` | `5001` | Local HTTP listener port (`5001` avoids macOS AirPlay conflict on `5000`) |
| `NODE_ENV` | `development` | `development`, `test`, or `production` |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/roots_ems` | Local standalone `mongod` URI (or MongoDB Atlas `mongodb+srv://...` on Vercel) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin(s), comma-separated if multiple |
| `APP_TIMEZONE` | `Asia/Kolkata` | Business calendar timezone used to normalize "today" to UTC midnight |

### `client/.env.example`
| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `/api` | `/api` locally (via Vite proxy); `https://<your-backend>.vercel.app/api` on Vercel |

---

## Project Structure

```text
HRootsMERNAssessment/
├── server/
│   ├── api/index.js                  # Vercel serverless Express entry
│   ├── scripts/seed.js               # Standalone optional demo seeder (decoupled from runtime)
│   ├── src/
│   │   ├── config/                   # env.js, cached serverless-safe db.js
│   │   ├── constants/enums.js        # Departments, statuses, priorities, priorityRanks, transitions
│   │   ├── models/                   # Counter.js, Employee.js, Task.js
│   │   ├── validators/               # Express 5-safe Zod schemas (employee & task)
│   │   ├── services/                 # Domain business rules, dashboard $facet, streaming CSV
│   │   ├── controllers/              # Thin HTTP controllers
│   │   ├── routes/                   # REST routers (/export.csv mounted strictly above /:id)
│   │   ├── middleware/               # validate, validateObjectId, centralized errorHandler
│   │   └── utils/                    # ApiError, UTC calendar dates, shared overdue, queryBuilder, csv
│   ├── tests/                        # Vitest + Supertest + mongodb-memory-server suites
│   └── vercel.json
└── client/
    ├── src/
    │   ├── api/                      # Fetch client, CSV blob downloader, typed endpoint wrappers
    │   ├── components/layout/        # Responsive macOS sidebar / tablet rail / iOS bottom tab bar
    │   ├── components/ui/            # Reusable CSS-Module primitives (zero inline styles)
    │   ├── constants/enums.js        # Valid status transition map & domain constants
    │   ├── hooks/useAppHooks.js      # useUrlFilters (useSearchParams), useDebounce, useTheme
    │   ├── pages/                    # Dashboard, Employee List/Form/Detail, Task List/Form/Detail
    │   ├── styles/                   # Apple HIG tokens.css (Light/Dark) + shared surface styles
    │   └── utils/dates.js            # Timezone-safe UTC display & input formatters
    └── vercel.json                   # SPA rewrite fallback preserving deep links & query params
```

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health check |
| `GET` | `/api/meta` | Enums, priority ranks, valid transitions, max capacity (`3`) |
| `GET` | `/api/dashboard` | Server-aggregated employee/task counts, breakdowns, overdue spotlight & employee workload |
| `GET` | `/api/employees` | Paginated server search (`fullName`, `employeeId`, `email`, `role`), department/status filters & sorting |
| `GET` | `/api/employees/options` | Lightweight employee options with live `activeTaskCount` & `availableSlots` |
| `POST` | `/api/employees` | Create employee (`409` on duplicate `employeeId` or normalized `email`) |
| `GET` | `/api/employees/:id` | Employee profile details (`404` if missing/invalid ID) |
| `PUT` | `/api/employees/:id` | Update employee & synchronize `assigneeSnapshot` on assigned tasks |
| `DELETE` | `/api/employees/:id` | Delete employee (`400` if holding `Todo` or `In Progress` tasks; preserves snapshot otherwise) |
| `GET` | `/api/employees/:id/tasks` | List tasks assigned to an employee with `isOverdue` enrichment |
| `GET` | `/api/tasks` | Paginated server search (`title`, `taskId`, employee `fullName`), composable filters (`department`, `priority`, `status`, `duePreset`, `dueDate`, `assignee`, `overdue`) & importance sorting (`priorityRank`) |
| `GET` | `/api/tasks/export.csv` | Cursor-streamed RFC-4180 CSV (with UTF-8 BOM) for **all** tasks matching active filters |
| `POST` | `/api/tasks` | Create task as `Todo` (auto `TSK-0001`, checks Active/Leave/Capacity; rejects `status` & `completedDate`) |
| `GET` | `/api/tasks/:id` | Task details with populated assignee or preserved former-employee snapshot |
| `PUT` | `/api/tasks/:id` | Edit non-terminal task (`400` if `Completed`/`Cancelled` or if `status`/`completedDate` sent) |
| `PUT` | `/api/tasks/:id/status` | **Dedicated status state-machine endpoint** (`Todo -> In Progress -> Completed`, `Todo \| In Progress -> Cancelled`) |
| `DELETE` | `/api/tasks/:id` | Delete task and release assignee's active slot if `Todo` or `In Progress` |

---

## MongoDB Schema & Employee → Task Relationship

### 1. `Employee`
- `employeeId` (`String`, unique, trimmed, uppercased)
- `fullName` (`String`), `email` (`String`, unique, trimmed, lowercased), `phone` (`String`)
- `department` (`Development | Design | QA | HR | Sales`), `role` (`String`), `joiningDate` (UTC midnight `Date`)
- `status` (`Active | Inactive | On Leave`), `leaveStart` & `leaveEnd` (required & `leaveEnd >= leaveStart` when `On Leave`; auto-cleared to `null` otherwise)
- `skills` (`String[]`), `activeTaskCount` (`Number`, `0..3`, atomically managed by backend)

### 2. `Task` & Hybrid Reference + Snapshot Relationship (`1 Employee → N Tasks`)
Each `Task` stores **both**:
1. `assignee`: `ObjectId` reference to `Employee` (for live capacity joins and active profile links).
2. `assigneeSnapshot`: embedded subdocument `{ employeeId, fullName, email, department, role, isDeleted }` synchronized when an active employee's profile is edited.

### How Employee Deletion Is Handled
1. **Guard Check:** `DELETE /api/employees/:id` verifies both `employee.activeTaskCount === 0` and `Task.countDocuments({ assignee: id, status: { $in: ['Todo', 'In Progress'] } }) === 0`. If any active task exists, deletion is rejected with `400 Bad Request` (`"Cannot delete employee with active tasks (Todo or In Progress)"`).
2. **Non-Destructive Historical Preservation:** Once all tasks for that employee are `Completed` or `Cancelled`, deleting the employee removes the `Employee` document and updates their historical tasks via `Task.updateMany({ assignee: id }, { $set: { assignee: null, 'assigneeSnapshot.isDeleted': true } })`. Historical tasks in the Task List, Task Detail view, and CSV Export continue displaying the employee's full name, Employee ID, role, department, and a `"Former Employee"` indicator—never `"Unknown"` or `null` crashes.

---

## Answers to Mandatory Architecture Questions

### 1. Where do you validate status transitions and why?
Status transitions are enforced **authoritatively in the backend service layer (`task.service.js` → `updateTaskStatus`) exclusively behind `PUT /api/tasks/:id/status`**, backed by a single `STATUS_TRANSITIONS` adjacency map (`Todo -> [In Progress, Cancelled]`, `In Progress -> [Completed, Cancelled]`, `Completed -> []`, `Cancelled -> []`) and an atomic compare-and-swap query (`Task.findOneAndUpdate({ _id, status: currentStatus }, ...)`). Meanwhile, `POST /api/tasks` and `PUT /api/tasks/:id` explicitly reject any request payload containing a `status` key (`400`) in `task.validator.js`. The frontend also mirrors `VALID_STATUS_TRANSITIONS` so dropdowns only show valid next choices for good UX, **but frontend checks can always be bypassed via curl/Postman/DevTools**—centralizing transition enforcement on the dedicated backend endpoint guarantees no client can jump `Todo -> Completed`, reopen a `Completed` task, or bypass capacity release logic.

### 2. Why does `Completed Date` come from the backend?
`completedDate` is an audit/SLA timestamp recording when the task *actually* transitioned to `Completed`. Trusting a client-supplied date fails for two reasons: (a) client system clocks can be skewed, misconfigured across timezones, or intentionally backdated to hide overdue SLA breaches, and (b) a client could set `completedDate` on a task that isn't `Completed`. Rejecting `completedDate` in request validators (`400`) and stamping `completedDate = new Date()` inside `updateTaskStatus` at the exact moment `newStatus === 'Completed'` ensures tamper-proof, server-authoritative timestamps.

### 3. How do you block inactive / on-leave assignment?
Inside `claimEmployeeCapacity(employeeId, startDate)` in `server/src/services/task.service.js` (invoked on task creation, assignee reassignment, and start-date edits):
1. All calendar dates (`startDate`, `leaveStart`, `leaveEnd`) are normalized to UTC midnight (`YYYY-MM-DDT00:00:00.000Z`) so local server/client timezone offsets (e.g., IST `+05:30`) never shift dates by a day.
2. If `employee.status === 'Inactive'`, the service immediately throws `400` (`"Cannot assign tasks to an Inactive employee"`).
3. If `employee.status === 'On Leave'`, the service checks `startDate >= leaveStart && startDate <= leaveEnd` (both boundaries inclusive) and throws `400` if inside the window; tasks starting strictly before `leaveStart` or strictly after `leaveEnd` remain permitted.
4. Both predicates (`status: 'Active'` OR `{ status: 'On Leave', $or: [{ leaveStart: { $gt: startDate } }, { leaveEnd: { $lt: startDate } }] }`) are also embedded directly inside the atomic `Employee.findOneAndUpdate` filter so concurrent status updates cannot slip past the pre-check.

### 4. Why are filtering and pagination on the backend?
Fetching the entire collection into React (`Task.find({})`) and filtering/slicing in browser memory breaks down as data grows: it wastes network bandwidth, serializes thousands of unneeded documents on every request, freezes mobile devices during client-side sorting/regex matching, and causes memory spikes on serverless functions. Executing search, composable `$and` filters, indexed `priorityRank` sorting, and `.skip().limit()` pagination in MongoDB transfers only the 8–10 rows needed for the current viewport while keeping response latency flat regardless of dataset size.

### 5. Why do filters live in the URL?
Storing `search`, `department`, `priority`, `status`, `duePreset`, `dueDate`, `assignee`, `sortBy`, `sortOrder`, and `page` in URL query parameters (`useSearchParams` via `useUrlFilters`) makes the browser address bar the single source of truth:
- **Refresh resilience:** Reloading `/tasks?status=In%20Progress&priority=High&page=2` queries the exact same filtered page instead of wiping state back to defaults.
- **Shareability & deep linking:** A manager can copy a filtered URL (or click the Dashboard's `"Overdue Tasks"` tile → `/tasks?overdue=true`) and send it to a teammate who sees the identical view.
- **History navigation & CSV parity:** Browser Back/Forward buttons step naturally through filter changes, and the `"Export CSV"` button passes the exact same URL filter parameters to `/api/tasks/export.csv`.

### 6. What can go wrong if two requests assign a 4th active task at the same time?
With a naive **check-then-act (TOCTOU)** implementation—where Request A and Request B both run `Task.countDocuments({ assignee, status: { $in: ['Todo', 'In Progress'] } })` concurrently when the employee has `2` active tasks—both requests read `count = 2` (`< 3`), both pass validation, and both call `Task.create(...)`, leaving the employee with **4 active tasks** and violating the max-3 business rule.  
Furthermore, multi-document transactions (`session.startTransaction()`) fail on standalone local MongoDB instances (`Transaction numbers are only allowed on a replica set member`).  
**Our Solution:** Single-document operations in MongoDB are always atomic—even on standalone `mongod`. We maintain `activeTaskCount` on `Employee` and reserve capacity via a single atomic conditional update:
```js
Employee.findOneAndUpdate(
  { _id: employeeId, activeTaskCount: { $lt: 3 }, /* + status/leave guard */ },
  { $inc: { activeTaskCount: 1 } },
  { new: true }
)
```
When two parallel requests race for the 3rd slot (`2 -> 3`), MongoDB serializes the document-level write lock: the first request increments `2 -> 3` and succeeds (`201`), while the second sees `activeTaskCount === 3`, fails the `$lt: 3` predicate (`null`), and deterministically returns `400`. If `Task.create` subsequently fails, a `try/catch` compensating decrement (`$inc: -1`) releases the reserved slot. This exact race is verified via `Promise.all` in `server/tests/tasks-rules.test.js`.

---

## Deploying to Vercel (Two Separate Projects)

1. **Database (MongoDB Atlas):** Because Vercel serverless functions run in the cloud and cannot reach `127.0.0.1:27017` on your laptop, create a free MongoDB Atlas M0 cluster and copy its `mongodb+srv://...` connection string.
2. **Backend Project (`server` root directory on Vercel):**
   - Import the repo into Vercel with **Root Directory** = `server` (`server/vercel.json` routes all traffic to `server/api/index.js`).
   - Set Environment Variables: `MONGODB_URI`, `CORS_ORIGIN` (your Vercel frontend URL), `NODE_ENV=production`, `APP_TIMEZONE=Asia/Kolkata`.
3. **Frontend Project (`client` root directory on Vercel):**
   - Import the repo into Vercel with **Root Directory** = `client` (`client/vercel.json` rewrites SPA routes to `/index.html`).
   - Set Environment Variable: `VITE_API_URL=https://<your-backend-project>.vercel.app/api`.

---

## Assumptions
- Calendar dates (`joiningDate`, `leaveStart`, `leaveEnd`, `startDate`, `dueDate`) are treated as timezone-independent calendar dates (`YYYY-MM-DD` normalized to UTC midnight), with "today" evaluated in `APP_TIMEZONE` (`Asia/Kolkata` by default). A task due *today* is due today—not overdue—until tomorrow (`today > dueDate`).
- Employees can be updated between `Active`, `On Leave`, and `Inactive` so evaluators can freely test assignment blocking rules across statuses.
- Optional standalone `npm run seed` (`server/scripts/seed.js`) is provided strictly as a developer CLI convenience and is never imported by Express or React runtime code.
