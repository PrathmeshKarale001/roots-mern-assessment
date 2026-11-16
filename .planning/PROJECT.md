# Roots Employee & Task Management System

## What This Is

A full-stack MERN (MongoDB, Express, React, Node.js) Employee & Task Management System built for the Roots Media Marketing MERN Stack Developer Technical Assignment. It enables an organization across five departments (Development, Design, QA, HR, Sales) to manage employee lifecycle and leave windows, assign and track prioritized tasks under strict backend-enforced business rules, export filtered CSV reports, and monitor real-time team capacity on an Apple-inspired dashboard.

## Core Value

Every business rule — active-only assignment, inclusive leave-window blocking, strict status transitions via a dedicated endpoint, server-authoritative completion dates, concurrency-safe 3-task capacity limits, consistent overdue calculation, and non-destructive employee deletion with historical task snapshots — is enforced deterministically on the backend and surfaced clearly through a refined Apple-grade interface.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Backend enforces all Employee & Task business rules (Active/Inactive/On-Leave inclusive start-date check, Due >= Start date, strict status state machine only via `PUT /api/tasks/:id/status`, locked Completed/Cancelled tasks, server-set `completedDate`, atomic max-3 active task capacity per employee, blocked deletion when holding active tasks, preserved employee snapshot on old tasks after employee deletion)
- [ ] RESTful CRUD APIs for Employees and Tasks with proper HTTP status codes (`400` validation/rule violation, `404` not found, `409` duplicate Employee ID or Email / blocked deletion)
- [ ] Server-side search, composable multi-field filtering, custom importance sorting, pagination, dashboard aggregation API, and filter-aware streaming CSV export
- [ ] Apple-inspired responsive UI (macOS frosted-glass sidebar on desktop, collapsible tablet layout, iOS bottom tab bar on mobile, light & dark modes, CSS Modules + design tokens, zero inline styles)
- [ ] Multi-route React SPA covering Dashboard, Employee List / Add / Edit / View, and Task List / Add / Edit / View with full URL query-string synchronization (`?search=...&status=...&priority=...&page=...`)
- [ ] Frontend + backend field validation, valid-next-status-only dropdowns, skeleton loading states, and friendly toast notifications displaying exact server business-rule messages
- [ ] Local MongoDB operation out of the box with clean optional seed script (`npm run seed`), two-project Vercel deployment readiness (`client/` + `server/`), `.env.example` files, and comprehensive `README.md` answering all 6 architectural questions

### Out of Scope

- User authentication / RBAC login — Explicitly excluded by the assignment specification ("No login/authentication is required")
- Hardcoded mock data inside React or Express runtime — Explicitly penalized in the assignment rubric; optional standalone `npm run seed` script is kept strictly separate from runtime code
- Inline styles (`style={{ ... }}`) or Tailwind utility soup — Assignment penalizes inline styles and user rules mandate Vanilla CSS / CSS Modules with curated tokens
- Copying the PDF's wireframe layout — User explicitly requested an original, aesthetically pleasing, modern Apple-themed layout instead

## Context

- **Source Specification**: `Roots_MERN_Intern_Assignment.pdf` (4 pages) defining Employee & Task entities, 8 strict backend business rules, server-side search/filter/sort/pagination/CSV/dashboard requirements, URL state persistence, negative-point rubric, and 6 mandatory README architecture questions.
- **Database Strategy**: Runs locally against standalone MongoDB (`mongodb://127.0.0.1:27017/roots_ems`) for development and local evaluation, with zero-code-change compatibility for MongoDB Atlas (`MONGODB_URI`) when deploying to Vercel. Because standalone local `mongod` does not support multi-document transactions, the 3-active-task capacity invariant MUST use single-document atomic conditional `$inc` (`findOneAndUpdate({ _id, status: 'Active', activeTaskCount: { $lt: 3 } }, { $inc: { activeTaskCount: 1 } })`) with compensating rollback on task write failure.
- **Visual Direction**: Apple Human Interface Guidelines (macOS Sequoia / iPadOS 18 aesthetic) — SF Pro / Inter typography, translucent vibrancy (`backdrop-filter: blur(20px) saturate(180%)`), grouped inset surfaces, hairline borders, Apple system semantic colors (`#0071E3` / `#0A84FF` blue, green, orange, red, indigo), spring micro-interactions, and Apple Watch Activity-ring inspired workload indicators (0/3 to 3/3 active tasks).

## Constraints

- **Tech Stack (Backend)**: Node.js 24, Express, MongoDB + Mongoose, Zod validation, Vitest + Supertest + `mongodb-memory-server` — Required by MERN assignment + rigorous rule verification
- **Tech Stack (Frontend)**: Vite + React, React Router, TanStack Query, React Hook Form + Zod, Vanilla CSS Modules + Design Tokens — Required by assignment + user Vanilla CSS rule
- **Code Quality**: Zero inline styles, reusable component architecture, clean separation of routes → controllers → services → models, no committed `.env` secrets — Explicitly graded in assignment "Must Have" & "Negative Points"
- **Deployment Target**: Separate `client` and `server` Vercel configurations (`vercel.json` + serverless Express export in `server/api/index.js`) — Required for dual frontend/backend URL submission

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Atomic conditional `$inc` on `Employee.activeTaskCount` + live reconciliation | Prevents race condition when two concurrent requests assign a 4th active task (README Q6) even on standalone local `mongod` without replica-set transactions | — Pending |
| Embedded `assigneeSnapshot` on every `Task` alongside `assignee` ObjectId ref | Guarantees historical Completed/Cancelled tasks still render meaningful employee details (`employeeId`, `fullName`, `email`, `department`, `role`) after an employee is deleted | — Pending |
| Dedicated `PUT /api/tasks/:id/status` endpoint + strip/reject `status` & `completedDate` in `POST`/`PUT /api/tasks` | Enforces assignment rule that status cannot be edited via normal update API and `completedDate` never comes from frontend | — Pending |
| Shared `buildTaskFilterQuery()` & `computeIsOverdue()` across list, detail, dashboard, and CSV | Guarantees 100% consistent overdue semantics (`today > dueDate` in UTC-normalized date comparison and status not in `Completed`/`Cancelled`) and identical filter behavior between UI table and CSV export | — Pending |
| Vanilla CSS Modules + Apple HIG token stylesheet (`tokens.css`) | Satisfies both user rule (Vanilla CSS, stunning rich aesthetics) and PDF rubric (no inline styles, responsive mobile/tablet/desktop) | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

---
*Last updated: 2026-11-16 after initialization*
