# Feature Research

**Domain:** Enterprise Employee Lifecycle & Task Capacity Management System (MERN Technical Assessment)
**Researched:** 2026-11-16
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Evaluators & Users Expect These)

Every item below is directly graded in `Roots_MERN_Intern_Assignment.pdf` ("Task", "Business Rules", "Must Have"). Missing or partially implementing any of these results in direct rubric deductions.

#### 1. Executive Dashboard (`/` & `GET /api/dashboard`)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Server-Calculated Employee Counts** | Explicitly mandated ("Dashboard: all numbers come from the backend") | LOW | Single MongoDB `$facet` aggregation returning `total`, `active`, `inactive`, and `onLeave` counts. Zero `array.length` math in React. |
| **Server-Calculated Task Counts** | Explicitly shown on PDF p.4 & mandated in Backend rules | MEDIUM | Returns `total`, `todo`, `inProgress`, `completed`, `cancelled`, and `overdue` counts using the shared server UTC date boundary (`today > dueDate` and status not in `Completed`/`Cancelled`). |
| **Status, Priority & Department Breakdowns** | Operational visibility across the 5 departments (`Development`, `Design`, `QA`, `HR`, `Sales`) and 4 priorities | MEDIUM | Server-aggregated distribution counts enabling proportional Apple-style progress bars and quick drill-down links (clicking `High` opens `/tasks?priority=High`). |
| **Overdue Tasks Spotlight** | Overdue rule explicitly lists Dashboard as one of the 4 required surfaces (`list, details, dashboard and CSV`) | MEDIUM | Dedicated dashboard panel surfacing top overdue active tasks with days-past-due badge, assignee name, priority, and 1-click link to `/tasks/:id`. |
| **Per-Employee Workload Summary** | Explicitly required ("counts and employee workload calculated on the server", PDF p.1 & p.4) | MEDIUM | Server-aggregated workload list showing each employee, department/role, status, and active task count (`Todo + In Progress`, `0` to `3`), sorted by highest utilization first. |

#### 2. Employee Management CRUD, View & Assigned Tasks (`/employees/*`)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Multi-Route Employee Screens** | PDF p.2 "Must Have": separate routes for List, Add form, Edit form, and View details | MEDIUM | Routes: `/employees` (List), `/employees/new` (Add), `/employees/:id/edit` (Edit), `/employees/:id` (View). Modal-only CRUD fails the multi-routing requirement. |
| **Complete Employee Schema & Unique Identity** | PDF p.1 entity specification + `409` duplicate check | MEDIUM | Fields: `employeeId` (unique, trimmed uppercase e.g. `EMP-001`), `fullName`, `email` (unique, normalized via `trim().toLowerCase()`), `phone`, `department` (`Development` \| `Design` \| `QA` \| `HR` \| `Sales`), `role`, `joiningDate`, `status` (`Active` \| `Inactive` \| `On Leave`), `skills` (string array), `leaveStart`, `leaveEnd`. Duplicate `employeeId` or `email` returns HTTP `409`. |
| **Conditional On-Leave Window Lifecycle** | PDF p.1: `Leave Start` and `Leave End` apply *only* when status is `On Leave` | MEDIUM | Frontend dynamically reveals/requires `leaveStart` and `leaveEnd` when `status === 'On Leave'` (`leaveEnd >= leaveStart`). Backend rejects missing/inverted leave dates when `On Leave` (`400`) and strips/nullifies `leaveStart`/`leaveEnd` when switching to `Active` or `Inactive`. |
| **Protected Deletion & Historical Snapshot Preservation** | PDF p.1 Business Rule: cannot delete employee with `Todo`/`In Progress` tasks; old tasks keep meaningful details | HIGH | Backend blocks `DELETE /api/employees/:id` (`409` / `400` with clear message) while active tasks exist. When only `Completed`/`Cancelled` (or zero) tasks exist, employee is deleted, `Task.assignee` ref becomes unresolvable/null, and `Task.assigneeSnapshot` (`employeeId`, `fullName`, `email`, `department`, `role`) preserves full historical attribution. |
| **Employee View + Assigned Tasks List** | PDF p.1/p.2 View details page requirement | MEDIUM | `GET /api/employees/:id` returns employee profile plus task summary & assigned tasks list so evaluators can inspect workload, leave window, and task history from one screen. |

#### 3. Task Management CRUD, Dedicated Status Flow & Filter-Synced CSV (`/tasks/*`)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Multi-Route Task Screens & Auto `TSK-XXX` ID** | PDF p.2 "Must Have" routing + PDF p.3 wireframe showing `TSK-001`..`TSK-005` | MEDIUM | Routes: `/tasks` (List), `/tasks/new` (Add), `/tasks/:id/edit` (Edit), `/tasks/:id` (View). Auto-generate human-readable `taskId` (`TSK-001` via atomic `Counter` collection) alongside Mongo `_id`. |
| **Active / On-Leave Assignment Validation** | PDF p.1 core rule & README Q3 | HIGH | Backend checks target assignee on create & reassignment: `Inactive` → always reject (`400`); `On Leave` → reject (`400`) **only if** task `startDate` falls within `[leaveStart, leaveEnd]` (**both dates inclusive**); `Active` (or `On Leave` with `startDate` outside leave window) → allowed subject to capacity. |
| **Concurrency-Safe Max-3 Active Task Capacity** | PDF p.1 core rule & README Q6 race-condition question | HIGH | Employee can hold at most 3 active tasks (`Todo + In Progress`). Enforced atomically via single-document conditional `$inc` (`findOneAndUpdate({ _id, status: { $ne: 'Inactive' }, activeTaskCount: { $lt: 3 } }, { $inc: { activeTaskCount: 1 } })`) with compensating rollback if task insert/update fails—works on standalone local `mongod` and Atlas alike. |
| **Dedicated Status Machine (`PUT /api/tasks/:id/status`)** | PDF p.1 & p.2 "Negative Points" + README Q1 | HIGH | New tasks always start as `Todo`. Valid transitions: `Todo → In Progress`, `Todo → Cancelled`, `In Progress → Completed`, `In Progress → Cancelled`. Any other jump (`Todo → Completed`, `In Progress → Todo`, or mutating `Completed`/`Cancelled`) returns `400`. Normal `POST /api/tasks` and `PUT /api/tasks/:id` strip/reject `status`. UI dropdown renders **only valid next statuses**. |
| **Locked Terminal Tasks & Server-Set `completedDate`** | PDF p.1 & README Q2 | MEDIUM | Transitioning to `Completed` stamps `completedDate = new Date()` on the server (never accepted from client payload). Once `Completed` or `Cancelled`, `PUT /api/tasks/:id` is rejected (`400`) and Edit UI actions are locked/guarded. |
| **Consistent Overdue Computation Across All 4 Surfaces** | PDF p.1: "Overdue: today is later than Due Date and status is not Completed or Cancelled. Show it consistently in list, details, dashboard and CSV." | MEDIUM | Single shared date-normalized helper (`startOfUTCDate(now) > startOfUTCDate(dueDate) && !['Completed', 'Cancelled'].includes(status)`) used in Task serialization (List + View), Dashboard `$facet`, and CSV formatter. |
| **Filter-Synced Full-Dataset CSV Export** | PDF p.1: "Export CSV downloads all tasks matching the current filters (not only the visible page)." | MEDIUM | `GET /api/tasks/export` reuses the exact same `buildTaskFilterQuery()` and sort builder as `GET /api/tasks` **without** `skip`/`limit`, streaming RFC-4180 escaped CSV rows (`Task ID`, `Title`, `Assignee Name`, `Assignee ID`, `Assignee Status`, `Department`, `Priority`, `Status`, `Start Date`, `Due Date`, `Completed Date`, `Overdue`). |

#### 4. Cross-Cutting Platform Capabilities (Search, URL State, Validation, UX Feedback)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Server-Side Search, Composable Filters, Importance Sort & Pagination** | PDF p.1 & p.2 "Negative Points" + README Q4 | HIGH | **Tasks**: search (`title`, `assigneeSnapshot.fullName`), filters (`department`, `priority`, `status`, `dueDateFrom`, `dueDateTo`—composable via `$and`), sort (`createdAt`, `dueDate`, `title`, and `priority` ranked via `$addFields` numeric weight `Low:1, Medium:2, High:3, Critical:4`), pagination (`page`, `limit`, `total`, `totalPages`). **Employees**: search (`fullName`, `email`, `employeeId`), filters (`department`, `status`), sort (`joiningDate`, `fullName`, `activeTaskCount`, `createdAt`), pagination. |
| **URL Query Parameter Persistence** | PDF p.1 & README Q5: `/tasks?status=In%20Progress&priority=High&page=2` survives refresh & sharing | MEDIUM | `useSearchParams` is the **single source of truth** (never mirrored into drifting `useState`). Changing any search/filter resets `page=1`; debounced search uses `{ replace: true }` to keep browser Back history clean; default/empty params are stripped. |
| **Dual Frontend + Backend Field Validation & HTTP Semantics** | PDF p.1: `400` invalid/rule violation, `404` not found, `409` duplicate ID/email; validate each field FE + BE | MEDIUM | Field rules: email RFC format + lowercase normalization, phone pattern (`7–15` digits/standard formatting), non-empty trimmed strings with max lengths, `dueDate >= startDate`, `leaveEnd >= leaveStart` when `On Leave`, enum membership for department/priority/status. |
| **Friendly Server-Error Notifications & Loading Skeletons** | PDF p.2 "Must Have" & p.3 wireframe inline error callout | LOW | Global toast notification queue displaying exact backend business-rule messages **plus** inline form error alert banners above Submit (matching PDF p.3 `"Employee already has 3 active tasks. Please choose another employee."`), paired with layout-matched shimmer skeletons and button spinner states. |

---

### Differentiators (Apple-Inspired UX & Creative View Pages)

The assignment explicitly notes *"The design shows layout and flow only"* (p.1) and *"Use your creativity for the View Pages"* (p.1). These differentiators elevate the submission from a standard CRUD table into an Apple Human Interface Guidelines (macOS Sequoia / iPadOS 18) experience while directly reinforcing backend business rules visually.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Adaptive Apple Navigation Shell (macOS Frosted Sidebar + iOS Bottom Tab Bar)** | Replaces the generic dark top-bar wireframe with an original, responsive Apple-grade spatial hierarchy across Desktop, Tablet, and Mobile | MEDIUM | Desktop (`>=1024px`): fixed 240px macOS Sequoia sidebar with translucent material (`backdrop-filter: blur(20px) saturate(180%)`), hairline `1px` border, quick counts, and theme switcher. Tablet (`768–1023px`): collapsible icon/label rail. Mobile (`<768px`): floating iOS frosted bottom tab bar (`Dashboard`, `Employees`, `Tasks`) keeping primary navigation thumb-reachable. |
| **Radial Capacity Ring Gauges (`0/3` .. `3/3`)** | Turns the abstract "max 3 active tasks" rule into an instant, glanceable visual cue everywhere employees appear | LOW | Crisp SVG radial arc progress gauge styled with Apple semantic tokens (`0/3` muted track, `1/3` System Green `#34C759`, `2/3` System Blue `#0071E3`, `3/3` System Orange/Red `#FF9F0A`/`#FF3B30` with `"Full"` pill). Reused across Dashboard Workload, Employee List, Employee View, and Task Assignee Selector. |
| **Task View: Interactive Status Stepper & Audit Timeline (`/tasks/:id`)** | Answers *"Use your creativity for the View Pages"* by making the backend state machine tangible and interactive | MEDIUM | Visualizes `Todo → In Progress → Completed` (plus `Cancelled` terminal branch) as an Apple-styled horizontal/vertical milestone stepper. Shows `Created Date`, `Start Date`, `Due Date`, and server-stamped `Completed Date`, while offering 1-click valid next-status transition buttons wired to `PUT /api/tasks/:id/status` (and a lock badge when terminal). |
| **Task View: Contextual Overdue Callout & Former Employee Snapshot Card** | Surfaces two of the trickiest rubric rules (consistent overdue + post-deletion task integrity) with unmistakable clarity | LOW | If overdue, renders a high-contrast semantic red tinted callout banner (`"Overdue by X days — Due DD MMM YYYY"`). In the Assignee card, if the linked employee still exists, links to `/employees/:id` with live capacity ring; if deleted, seamlessly renders `assigneeSnapshot` (`fullName`, `employeeId`, `department`, `role`, `email`) with a refined `"Former Employee · Historical Record"` badge. |
| **Employee View: Executive Hero Card, Skill Pills & Leave Window Timeline (`/employees/:id`)** | Transforms Employee View into an HR command center that explains *why* assignments succeed or fail | MEDIUM | **Hero Card**: department-tinted monogram avatar, `EMP-XXX` badge, semantic status dot, role/department metadata, tenure badge computed from `joiningDate`, and `mailto:`/`tel:` actions. **Skill Pills**: curated Apple token chips. **Active Leave Timeline**: when `On Leave`, renders a visual date-range bar (`leaveStart` → Today marker → `leaveEnd`) noting that tasks starting inside this inclusive window are blocked. **Live Task Breakdown**: mini segmented status counters + clickable assigned task list + contextual `"+ Assign Task"` CTA (pre-selecting `/tasks/new?assignee=:id` when eligible). |
| **Proactive Pre-Flight Hints in Task Assignee Selector** | Prevents user frustration before submit while preserving 100% backend authority | LOW | Assignee picker displays each employee's status badge, `activeTaskCount/3` mini-ring, and leave dates inline, showing non-blocking warnings if the chosen `startDate` overlaps an employee's leave window or if capacity is `3/3`—while still allowing evaluators to test and verify backend `400` rejection if desired or via API. |
| **System-Synced Light & Dark Mode Token Engine** | Delivers flagship macOS Sequoia polish in both daylight and dark-room evaluation environments | LOW | Three-way segmented control (`Light` / `System` / `Dark`) backed by CSS Custom Properties in `tokens.css` (`--surface-primary`, `--glass-bg`, `--border-hairline`, semantic status hues) initialized before first paint to prevent theme flash. |

---

### Anti-Features (Explicitly Penalized in Rubric — Do NOT Build)

These features either trigger **explicit negative points** on PDF Page 2 or actively undermine mandatory assignment rules.

| Anti-Feature | Why Tempting | Why Problematic (Rubric Penalty) | What to Do Instead |
|--------------|--------------|----------------------------------|--------------------|
| **Login / Authentication / JWT / RBAC Walls** | Standard boilerplate in most MERN tutorials | PDF p.1 explicitly states *"No login/authentication is required."* Adding auth blocks evaluators from immediately testing deep links like `/tasks?status=In%20Progress&page=2` or hitting REST endpoints directly during grading. | Boot directly into the Dashboard (`/`), keep all `/api/*` endpoints accessible without auth headers, and focus engineering effort on deterministic business-rule enforcement. |
| **Client-Side Filtering, Sorting, or Pagination in React** | Fast to prototype with `tasks.filter(...).slice(...)` after fetching `GET /api/tasks` | **Explicit Negative Point (PDF p.2):** *"Fetching all records and filtering / paginating in React"* and directly tested in README Q4. Breaks network efficiency, pagination accuracy, and server-consistent overdue/priority logic. | Perform 100% of search, multi-field filtering, custom importance sorting, and `skip`/`limit` pagination inside MongoDB queries on the backend, driven by URL query params. |
| **Editable `Status` or `Completed Date` Inside Add/Edit Task Form (`POST`/`PUT /api/tasks`)** | Seems convenient to put all Task fields into one Edit form | **Explicit Negative Point (PDF p.2):** *"status editable through the normal update API"* and violates PDF p.1 (*"status is changed only through `PUT /api/tasks/:id/status`"* and *"Completed Date is set by the backend... never taken from the frontend"*). | Omit `status` and `completedDate` completely from Add/Edit Task forms; reject/strip them in `POST /api/tasks` and `PUT /api/tasks/:id`; drive all status transitions exclusively through `PUT /api/tasks/:id/status` via valid-next-status controls on Task List and Task View. |
| **Hardcoded Mock Arrays in React/Express or Committed `.env` Secrets** | Makes the UI look populated before MongoDB is wired | **Explicit Negative Point (PDF p.2):** *"Hardcoded mock data, committed passwords or secrets."* Masks broken aggregations and creates security/hygiene failures. | Query real MongoDB collections for 100% of runtime data, design clean empty states when DB has 0 records, provide an isolated CLI-only `npm run seed` script (`server/scripts/seed.js`), and commit `.env.example` while `.gitignore`-excluding `.env`. |
| **Inline Styles (`style={{ ... }}`) or Monolithic Page Components** | Quick one-off spacing/color tweaks during crunch time | **Explicit Negative Point (PDF p.2):** *"No componentization, inline styles, bad naming"* and violates project Vanilla CSS architecture rules. | Enforce **zero `style={{}}` props** across the React tree; use scoped Vanilla CSS Modules (`*.module.css`) consuming `tokens.css` variables and small reusable primitives (`Badge`, `CapacityRing`, `FilterBar`, `Pagination`, `StatusSelect`, `Skeleton`). |
| **Frontend-Only Business Rule Checks** | Disabling a form button in React feels like the rule is "handled" | **Explicit Negative Point (PDF p.2):** *"Business rules checked only in the frontend."* Evaluators test Express endpoints directly via Postman/cURL and concurrent requests. | Enforce all 8 business rules in backend Express services/models with automated Supertest integration tests; treat frontend validation and pre-flight hints strictly as UX enhancements. |
| **Modal-Only Forms Without Route Paths or Hard-Nullifying Deleted Assignees** | Single-page modals require fewer route files; setting `assignee: null` on delete is the default SQL/Mongo habit | Violates PDF p.2 *"Must Have: multiple routing (List view, Add form page, Edit form page, View details page) for both Employees and Tasks"* and PDF p.1 *"Old tasks must still show meaningful employee details if the employee is later deleted."* | Provide dedicated React Router pages (`/employees/new`, `/employees/:id/edit`, `/employees/:id`, `/tasks/new`, `/tasks/:id/edit`, `/tasks/:id`) and persist an immutable `assigneeSnapshot` subdocument on every Task. |

---

## Feature Dependencies

```
[MongoDB Schemas + Counter + Shared Date/Overdue Helpers]
    ├──requires──> [Employee CRUD + Unique 409 + Leave Validation + Safe Delete]
    │                  └──requires──> [Task CRUD + Active/Leave Check + Atomic 3-Task Capacity + Assignee Snapshot]
    │                                     ├──requires──> [Dedicated Status Machine (PUT /api/tasks/:id/status) + Server CompletedDate]
    │                                     ├──requires──> [Shared Task Filter/Sort Query Builder]
    │                                     │                  ├──requires──> [Paginated Task List API]
    │                                     │                  └──requires──> [Filter-Synced Full CSV Export API]
    │                                     └──requires──> [Server-Aggregated Dashboard API (Counts + Overdue + Workload)]
    │
[Apple Design Tokens + Responsive App Shell + Toast/Skeleton Primitives]
    └──requires──> [URL-Synced Hook (useUrlQueryState)]
                       ├──requires──> [Employee Screens (List, Add, Edit, Creative View + Leave Timeline)]
                       ├──requires──> [Task Screens (List + Inline Valid-Next Status + CSV Button, Add, Edit, Creative View + Stepper)]
                       └──requires──> [Executive Dashboard Screen (Stat Cards, Breakdowns, Overdue Spotlight, Capacity Rings)]
```

### Dependency Notes

- **Task CRUD & Capacity requires Employee CRUD & `activeTaskCount` field:** Every task creation, reassignment, status completion/cancellation, and employee deletion check depends on the Employee model's `status`, `leaveStart`/`leaveEnd`, `activeTaskCount` atomic counter, and snapshot fields (`employeeId`, `fullName`, `email`, `department`, `role`).
- **Filter-Synced CSV Export requires Shared Task Filter/Sort Query Builder:** Both `GET /api/tasks` and `GET /api/tasks/export` must invoke the exact same `buildTaskFilterQuery(query)` and `buildTaskSort(query)` functions so that whatever filters/search/sort are active in the URL produce an identical dataset in the downloaded CSV (minus pagination slicing).
- **Dashboard, Task List, Task View, and CSV all require Shared Overdue Helper:** Defining `computeIsOverdue(dueDate, status, now)` and `getUTCStartOfToday(now)` in one shared backend domain module prevents off-by-one timezone discrepancies across the 4 graded surfaces.
- **Task & Employee List Screens require `useUrlQueryState` (`useSearchParams`):** Building URL synchronization as a reusable hook first ensures filters, sorting, search debouncing, page-reset-on-filter, and CSV export link generation behave identically without local `useState` drift.
- **Dedicated Status Endpoint conflicts with Editable Status in Task Form:** Keeping status updates isolated to `PUT /api/tasks/:id/status` guarantees clean separation between metadata edits (locked once terminal) and state-machine transitions (which adjust `activeTaskCount` and stamp `completedDate`).

---

## MVP Definition

Because this is a graded technical assessment with a fixed rubric, **v1 must include 100% of graded functional requirements plus the signature Apple UX polish**—nothing from the PDF rubric can be deferred.

### Launch With (v1 — Complete Assessment Submission)

- [ ] **Backend Domain & Business Rules Engine** — Employee & Task Mongoose schemas, `TSK-XXX` counter, normalized unique email/ID (`409`), inclusive On-Leave blocking, `Due >= Start`, atomic max-3 active task capacity, dedicated `PUT /api/tasks/:id/status` state machine, locked terminal tasks, server-set `completedDate`, shared UTC overdue calculation, and blocked delete + `assigneeSnapshot` preservation.
- [ ] **Server-Side Query, CSV & Dashboard APIs** — Paginated CRUD, server search (`title`, `employee name`), composable filters (`department`, `priority`, `status`, `dueDate` range), custom priority-importance sort, streaming filter-synced `GET /api/tasks/export`, and server-aggregated `GET /api/dashboard`.
- [ ] **Apple HIG Responsive Shell & Token System** — Zero-inline-style CSS Modules + `tokens.css`, Light/Dark/System theme toggle, macOS frosted sidebar (desktop), collapsible rail (tablet), iOS bottom tab bar (mobile), toast notifications, inline form rule banners, and shimmer loading skeletons.
- [ ] **All 9 Multi-Route Screens with URL Persistence** — Dashboard (`/`), Employee List (`/employees`), Add (`/employees/new`), Edit (`/employees/:id/edit`), Creative Employee View (`/employees/:id` with hero card, radial capacity ring, skill pills, leave window timeline, assigned tasks), Task List (`/tasks` with URL-synced search/filters/sort/page, valid-next-status dropdown, CSV export), Add (`/tasks/new`), Edit (`/tasks/:id/edit` without status/completedDate), and Creative Task View (`/tasks/:id` with interactive status stepper, overdue banner, and Former Employee snapshot badge).
- [ ] **Verification, Seed Script & Submission Docs** — Automated backend integration tests covering all 8 rules + concurrency race condition, optional `npm run seed`, `.env.example`, dual Vercel deployment config, and `README.md` answering all 6 architectural questions.

### Add After Validation (v1.x — Polish If Time Permits Within Scope)

- [ ] **Keyboard-Accessible Quick Filter Chips & "Clear All Filters" Reset Pill** — Triggered when 1+ URL filters are active on `/tasks` or `/employees` for instant filter recovery.
- [ ] **Dashboard Interactive Drill-Down Links** — Clicking `Overdue (5)` or an Employee row on Dashboard navigates directly to pre-filtered `/tasks` or `/employees/:id`.

### Future Consideration (v2+ — Explicitly Out of Assessment Scope)

- [ ] **Authentication / Role-Based Permissions** — Deferred permanently for submission because the PDF explicitly excludes login/auth.
- [ ] **Kanban Drag-and-Drop Board View** — Deferred so engineering focus stays on rock-solid URL-synced table filtering, pagination, and creative Detail View pages.
- [ ] **Task Comments / File Attachments / Email Webhooks** — Out of entity specification scope.

---

## Feature Prioritization Matrix

| Feature | Evaluator / User Value | Implementation Cost | Priority |
|---------|------------------------|---------------------|----------|
| **8 Backend Business Rules + Proper `400`/`404`/`409` Codes** | HIGH (Core grading rubric) | HIGH | **P1** |
| **Server-Side Search, Composable Filters, Priority-Rank Sort & Pagination** | HIGH (Core rubric + README Q4) | MEDIUM | **P1** |
| **Dedicated Status API + Valid-Next-Status UI + Server `completedDate`** | HIGH (Core rubric + README Q1/Q2) | MEDIUM | **P1** |
| **URL Query Parameter Sync Across Refresh & Share** | HIGH (Core rubric + README Q5) | MEDIUM | **P1** |
| **Filter-Synced Full-Dataset CSV Export + Consistent Overdue Flag** | HIGH (Core rubric) | MEDIUM | **P1** |
| **Server-Aggregated Dashboard (Counts, Overdue, Employee Workload)** | HIGH (Core rubric) | MEDIUM | **P1** |
| **9 Multi-Route Screens + Dual Validation + Friendly Error Notifications & Skeletons** | HIGH ("Must Have" rubric) | HIGH | **P1** |
| **Apple HIG Responsive Shell + Zero Inline Styles + Light/Dark Tokens** | HIGH (User mandate + UX rubric) | MEDIUM | **P1** |
| **Creative Employee & Task View Pages (Stepper, Capacity Rings, Leave Bar, Snapshot Badge)** | HIGH (Explicit PDF prompt: *"Use your creativity for the View Pages"*) | MEDIUM | **P1** |
| **Proactive Assignee Capacity/Leave Hints + Dashboard Drill-Down Links** | MEDIUM (Delightful UX polish) | LOW | **P2** |

**Priority key:**
- **P1:** Must ship in v1 for full rubric marks and Apple aesthetic standard
- **P2:** Low-cost polish layered smoothly into v1 components
- **P3:** Out-of-scope extras (avoid to prevent scope creep)

---

## Reference & Competitor Pattern Analysis

| Capability | PDF Wireframe (Layout Reference Only) | Typical Intern MERN Submission | Our Apple-Inspired Approach |
|------------|---------------------------------------|--------------------------------|-----------------------------|
| **App Navigation** | Basic dark top navbar (`Dashboard Employees Tasks`) | Unresponsive sidebar or Bootstrap navbar | Adaptive macOS Sequoia frosted sidebar (desktop), icon rail (tablet), iOS bottom tab bar (mobile) |
| **Capacity Visibility (`Max 3`)** | Plain integer in Dashboard table; error text only after failed submit | Often checked only on frontend or vulnerable to race conditions | Atomic server `$inc` guard + radial capacity ring (`0/3`–`3/3`) on Dashboard, Employee cards, and Assignee picker |
| **Status Transitions** | Inline row dropdown with valid next statuses | Editable `<select>` inside Edit Task form (loses points!) | Dedicated `PUT /api/tasks/:id/status` driving both List inline dropdown (valid next only) and Task View interactive stepper |
| **Detail / View Pages** | Not wireframed (*"Use your creativity for the View Pages"*) | Plain key-value dump of JSON fields | Executive Employee Hero + Skill Pills + Leave Window Timeline; Task Lifecycle Stepper + Overdue Callout + Former Employee Snapshot Card |
| **Deleted Employee Tasks** | Mentioned only in written business rules | Broken `null` crash or `"Unassigned"` losing history | Embedded `assigneeSnapshot` rendering full historical employee identity + `"Former Employee"` pill |
| **Error & Loading UX** | Inline red box above Submit on Task form | `window.alert()` or generic `"Something went wrong"` | Both inline Apple semantic alert callout on forms AND non-blocking toast notifications + shimmer skeletons |

---

## Sources

- **Primary Specification:** `Roots_MERN_Intern_Assignment.pdf` (Pages 1–4: Entity tables, 8 Backend Business Rules, Backend/Frontend checklists, Must Have / Negative Points rubric, 6 README architecture questions, and reference flow wireframes) — **Confidence: HIGH**
- **Project Charter:** `.planning/PROJECT.md` (Apple HIG visual direction, Vanilla CSS Modules constraint, atomic `$inc` concurrency strategy, `assigneeSnapshot` pattern, dual Vercel deployment target) — **Confidence: HIGH**
- **UI/UX Architecture Standards:** Apple Human Interface Guidelines — Sidebars, Tab Bars, Materials/Vibrancy, Clarity/Deference/Depth, and Semantic System Colors (`developer.apple.com/design/human-interface-guidelines`) — **Confidence: HIGH**
- **URL State Synchronization Patterns:** React Router `useSearchParams` + TanStack Query `placeholderData` single-source-of-truth pagination/filtering pattern — **Confidence: HIGH**

---
*Feature research for: Roots Employee & Task Management System*
*Researched: 2026-11-16*
