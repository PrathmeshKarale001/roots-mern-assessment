# Project Research Summary

**Project:** Roots Employee & Task Management System
**Domain:** Enterprise HR & Task Workflow SaaS (MERN Stack Technical Assignment)
**Researched:** 2026-11-16
**Confidence:** HIGH

## Executive Summary

The Roots Media Marketing MERN Stack Developer assignment tests architectural rigor far more than surface CRUD: all grading weight centers on eight interacting backend business invariants (active-only assignment, inclusive leave-window validation, strict state-machine transitions via a dedicated endpoint, server-authoritative completion timestamps, concurrency-safe max-3 active task capacity, shared UTC overdue semantics across four surfaces, and non-destructive employee deletion preserving historical task snapshots).

Our research establishes a five-layer Express 5 + Mongoose 8 backend paired with a Vite 8 + React 19 + TanStack Query v5 + Vanilla CSS Modules frontend styled after Apple Human Interface Guidelines (macOS Sequoia & iPadOS 18). Because the database runs on a standalone local `mongod` instance during evaluation (where replica-set multi-document transactions fail with Code 20) and later deploys as serverless functions on Vercel, capacity enforcement uses single-document atomic conditional `$inc` (`Employee.findOneAndUpdate` encoding status, leave-window, and `activeTaskCount < 3` predicates) with compensating rollback.

The two highest-severity rubric traps uncovered in research—(1) timezone off-by-one drift between UTC midnight dates and IST (`+05:30`) local timestamps, and (2) third-party chart/animation libraries injecting inline `style={{}}` attributes—are mitigated upfront via strict `YYYY-MM-DD` UTC calendar-date utilities and custom zero-inline-style SVG data visualizations (Apple Watch radial Activity rings, status donuts, and priority bars).

## Key Findings

### Recommended Stack

See [STACK.md](./STACK.md) for verified Node `v24.5.0` package matrix.

**Core technologies:**
- **Express `^5.3.0` + Mongoose `^8.24.9` + Zod `^4.6.7` (or `^3.24` compatible API)**: Native async error forwarding in Express 5 (`req.validatedQuery` pattern), global Mongoose connection promise caching for Vercel serverless, and shared schema validation.
- **Vite `^8.x` + React `^19.x` + React Router `^7.x` + TanStack Query `^5.x`**: First-class URL query-string state via `useSearchParams` (`placeholderData: keepPreviousData`) and RHF + Zod form validation.
- **Vanilla CSS Modules + `tokens.css` + Custom SVG Visuals + `sonner` + `lucide-react`**: Delivers an authentic Apple HIG light/dark experience with CSS `linear()` spring physics and **zero inline styles** anywhere in JSX or DOM.
- **Vitest + Supertest + `mongodb-memory-server` + `happy-dom`**: Full integration coverage of every business rule and concurrency race on Node `v24.5.0` without `jsdom` engine incompatibilities.

### Expected Features

See [FEATURES.md](./FEATURES.md) for complete rubric mapping.

**Must have (table stakes):**
- Server-aggregated Dashboard (`GET /api/dashboard`) with employee/task counts, status/priority/department breakdowns, overdue spotlight, and per-employee active workload (`0..3`).
- Full Employee & Task CRUD across dedicated multi-page routes (`/employees`, `/employees/new`, `/employees/:id/edit`, `/employees/:id`, `/tasks`, `/tasks/new`, `/tasks/:id/edit`, `/tasks/:id`).
- Dedicated `PUT /api/tasks/:id/status` state machine with valid-next-status-only UI menus, server-stamped `completedDate`, and locked terminal tasks.
- Server-side search, composable multi-filter queries, `priorityRank` importance sorting, pagination, URL state persistence, and full-filter streaming CSV export (`GET /api/tasks/export.csv`).

**Should have (competitive Apple differentiators):**
- Adaptive macOS Sequoia frosted glass sidebar (desktop), icon rail (tablet), and iOS bottom tab bar (mobile) with Light / Dark / System segmented theme switcher.
- Radial Apple Watch Activity-ring capacity gauges (`0/3` green, `1-2/3` blue/amber, `3/3` red) across Dashboard, Employee cards, and Assignee selector.
- Creative View pages: Task Detail interactive status stepper timeline + `"Former Employee"` snapshot badge; Employee Detail executive hero + skill pills + visual leave-window bar + quick `"+ Assign Task"` prefill.

**Defer (v2+ / Out of Scope):**
- Authentication/RBAC (explicitly excluded by prompt), drag-and-drop Kanban boards, email notifications.

### Architecture Approach

See [ARCHITECTURE.md](./ARCHITECTURE.md) for schemas, concurrency proofs, and data flows.

**Major components:**
1. **Domain Service Layer (`server/src/services/`)** — Houses `claimEmployeeCapacity()`, `releaseEmployeeCapacity()`, status compare-and-swap transitions, employee deletion guard, and `assigneeSnapshot` synchronization.
2. **Shared Query & Overdue Engine (`server/src/utils/`)** — `buildTaskFilterQuery()`, `buildTaskSortSpec()`, and UTC calendar-date `overdue.js` reused identically by Task List, Task Detail, Dashboard `$facet` pipeline, and cursor-streamed CSV export.
3. **URL-Driven React Feature Slices (`client/src/features/` & `client/src/components/ui/`)** — Tokenized CSS Module primitives wired to `useUrlFilters` (`useSearchParams`) and TanStack Query keys.

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for all edge cases and prevention rules.

1. **4th Active Task TOCTOU Race on Standalone `mongod`** — Solve with atomic conditional `Employee.findOneAndUpdate({ _id, activeTaskCount: { $lt: 3 }, $or: [...] }, { $inc: { activeTaskCount: 1 } })` + compensating rollback; never use `countDocuments` then `create` or replica-set-only transactions.
2. **Capacity Leaks on Reassignment, Terminal Status, or Task Delete** — Reserve new assignee slot before swapping `Task.assignee` and releasing old assignee slot; use status CAS on `Completed`/`Cancelled`; decrement `activeTaskCount` when deleting `Todo`/`In Progress` tasks.
3. **UTC vs IST (`+05:30`) Date Drift** — Normalize all calendar dates (`joiningDate`, `leaveStart`, `leaveEnd`, `startDate`, `dueDate`) to `YYYY-MM-DDT00:00:00.000Z` and compute `today` in `APP_TIMEZONE` (`Asia/Kolkata` default) normalized to UTC midnight.
4. **Express Static-vs-Parametric Route Ordering** — Mount `/api/tasks/export.csv` (and `/api/tasks/export`) strictly before `/api/tasks/:id`.
5. **Accidental Inline Styles** — Avoid Recharts/Framer Motion inline `style` injection; use SVG XML attributes (`strokeDasharray`, `strokeDashoffset`) and CSS Module `data-*` selectors.

## Implications for Roadmap

Based on dependencies and architecture boundaries, a 4-phase coarse roadmap delivers maximum velocity and clean verification gates:

### Phase 1: Backend Core, Schemas & Business Rules Engine
**Rationale:** Every downstream query, UI form, and dashboard widget depends on ironclad Mongoose schemas, UTC date utilities, and concurrency-safe domain rules.
**Delivers:** Express 5 app skeleton, cached MongoDB connector, `Counter`/`Employee`/`Task` models, Employee CRUD + deletion guard + snapshot sync, Task CRUD + atomic 3-task capacity + inclusive leave check + `PUT /api/tasks/:id/status`, central `ApiError` (`400`/`404`/`409`), and comprehensive Vitest + Supertest + `mongodb-memory-server` rule tests.

### Phase 2: Server Query Engine, Dashboard Aggregation, CSV Export & Seed
**Rationale:** Completes the entire backend API surface and Vercel serverless readiness before frontend integration begins.
**Delivers:** Server-side search/composable filters/`priorityRank` importance sort/pagination for Employees & Tasks, shared overdue calculation, cursor-streamed RFC-4180 CSV export (`GET /api/tasks/export.csv`), single-trip `$facet` Dashboard API (`GET /api/dashboard`), `/api/meta`, standalone `npm run seed` script, `server/api/index.js` + `server/vercel.json`, and integration tests.

### Phase 3: Apple Design System, App Shell, Dashboard & Employee Experience
**Rationale:** Locks the Apple HIG visual contract (`UI-SPEC.md`) first, builds reusable zero-inline-style CSS Module primitives, and wires Dashboard + full Employee vertical slice.
**Delivers:** Vite + React 19 + Router v7 + TanStack Query scaffold, `tokens.css` (Light/Dark), frosted macOS sidebar + iOS mobile tab bar, reusable UI kit (Button, Input, Select, SegmentedControl, Badge, CapacityRing, Modal, Pagination, Skeleton, EmptyState), Bento Dashboard with Activity rings & custom SVG charts, and Employee List (URL-synced) / Add / Edit / Creative Profile View.

### Phase 4: Task Management Experience, E2E Verification, Vercel & Submission Docs
**Rationale:** Completes the highest-interaction frontend vertical slice (Tasks + Status Flow + CSV Download), verifies the full system live against local `mongod`, and produces the graded README & deployment configs.
**Delivers:** Task List (URL-synced search/department/priority/status/due filters, importance sort, inline valid-next-status menu, filtered CSV export), Task Add/Edit forms surfacing server rule errors, Creative Task Detail View (status stepper timeline, overdue callout, former-employee snapshot card), `client/vercel.json`, `.env.example`s, and `README.md` with all 6 required architectural answers.

### Research Flags

Phases needing UI design contract (`gsd-ui-phase`):
- **Phase 3 & Phase 4:** Lock Apple HIG typography, spacing, semantic colors, zero-inline-style SVG contracts, and interaction states via `UI-SPEC.md` before planning.

Phases with complete architectural specs ready for direct planning (`--skip-research`):
- **Phase 1 & Phase 2:** Schemas, atomic queries, Express 5 patterns, and test harnesses are already specified in `STACK.md`, `ARCHITECTURE.md`, and `PITFALLS.md`.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against local Node `v24.5.0` / npm `11.14.1` and Express 5 / Mongoose 8 docs |
| Features | HIGH | Cross-checked line-by-line against all 4 pages of `Roots_MERN_Intern_Assignment.pdf` |
| Architecture | HIGH | Standalone `mongod` atomic concurrency + serverless connection caching proven |
| Pitfalls | HIGH | Covers README Q1–Q6, timezone normalization, route ordering, and inline-style ban |

**Overall confidence:** HIGH

### Gaps to Address

- **Zod v3 vs v4 syntax consistency:** Pin `zod@^3.24.2` with `@hookform/resolvers@^3.10.0` (or `zod@^4.x` with `@hookform/resolvers@^5+` verified during `npm install`) consistently in both `server/` and `client/` so schema syntax never diverges.

## Sources

### Primary (HIGH confidence)
- `Roots_MERN_Intern_Assignment.pdf` — Authoritative assignment specification and grading rubric
- Local runtime inspection — Node `v24.5.0`, npm `11.14.1`, Homebrew `mongod` on `127.0.0.1:27017`
- Express 5, Mongoose 8, React Router v7, TanStack Query v5, and Vercel Serverless Node documentation

---
*Research completed: 2026-11-16*
*Ready for roadmap: yes*
