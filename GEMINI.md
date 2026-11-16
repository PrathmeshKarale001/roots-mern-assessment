<!-- GSD:project-start source:PROJECT.md -->

## Project

**Roots Employee & Task Management System**

A full-stack MERN (MongoDB, Express, React, Node.js) Employee & Task Management System built for the Roots Media Marketing MERN Stack Developer Technical Assignment. It enables an organization across five departments (Development, Design, QA, HR, Sales) to manage employee lifecycle and leave windows, assign and track prioritized tasks under strict backend-enforced business rules, export filtered CSV reports, and monitor real-time team capacity on an Apple-inspired dashboard.

**Core Value:** Every business rule — active-only assignment, inclusive leave-window blocking, strict status transitions via a dedicated endpoint, server-authoritative completion dates, concurrency-safe 3-task capacity limits, consistent overdue calculation, and non-destructive employee deletion with historical task snapshots — is enforced deterministically on the backend and surfaced clearly through a refined Apple-grade interface.

### Constraints

- **Tech Stack (Backend)**: Node.js 24, Express, MongoDB + Mongoose, Zod validation, Vitest + Supertest + `mongodb-memory-server` — Required by MERN assignment + rigorous rule verification
- **Tech Stack (Frontend)**: Vite + React, React Router, TanStack Query, React Hook Form + Zod, Vanilla CSS Modules + Design Tokens — Required by assignment + user Vanilla CSS rule
- **Code Quality**: Zero inline styles, reusable component architecture, clean separation of routes → controllers → services → models, no committed `.env` secrets — Explicitly graded in assignment "Must Have" & "Negative Points"
- **Deployment Target**: Separate `client` and `server` Vercel configurations (`vercel.json` + serverless Express export in `server/api/index.js`) — Required for dual frontend/backend URL submission

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Node.js (ESM)** | `24.x` (`v24.5.0` local) | JavaScript runtime (`"type": "module"`) | Active LTS-grade runtime with native `node --watch`, built-in `fetch`, fast V8 startup on Vercel Serverless (`"engines": { "node": "24.x" }`), and native ES Modules across `server/` and `client/`. |
| **Express** | `^5.3.0` | REST API framework & serverless HTTP handler | **Cleanest rock-solid choice over Express 4.22 in 2026.** Express 5 natively forwards rejected promises from `async` route handlers and `async` middleware to `(err, req, res, next)` without monkey-patching (`express-async-errors`). On Vercel Serverless, uncaught async rejections in Express 4 hang lambdas until timeout; Express 5 terminates them deterministically. Vercel natively supports Express 5 via `@vercel/node`. |
| **MongoDB + Mongoose** | `^8.24.9` | ODM, schema validation, atomic updates & aggregation | **Pin `8.x` (`^8.24.9`) rather than bleeding-edge `9.x`.** Mongoose 8 is battle-tested on Node 24, pairs cleanly with `mongodb-memory-server@^11.3.0` and both local standalone `mongod` (`mongodb://127.0.0.1:27017/roots_ems`) and MongoDB Atlas (`mongodb+srv://`), and supports global promise caching (`bufferCommands: false`) for Vercel cold/warm lambdas. |
| **Zod** | `^4.6.7` | Isomorphic schema & payload validation (API + SPA) | Current stable v4 release (`4.6.7`) is ~14x faster at object parsing and 57% smaller in client bundle size than v3, while natively supported by `@hookform/resolvers@^7.0.6` (`peerDependencies: "^3.25.0 \|\| ^4.0.0"`). Powers strict request body/param/query parsing on the backend and form validation on the frontend. |
| **React + React DOM** | `^19.3.1` | Declarative UI library | Stable React 19 release; every chosen ecosystem package (`react-router-dom@7`, `@tanstack/react-query@5`, `react-hook-form@7`, `lucide-react@1`, `sonner@2`) explicitly declares `^19.0.0` peer support with zero `--legacy-peer-deps` workarounds. |
| **Vite + `@vitejs/plugin-react`** | `^8.3.8` / `^6.3.0` | Frontend dev server & production bundler | Rolldown/Oxc-powered Vite 8 delivers instant HMR, first-class `.module.css` scoping with hashed class names, lightning-fast static builds for Vercel, and seamless dev-time `/api` proxying to `localhost:5000`. |
| **React Router (`react-router-dom`)** | `^7.18.5` | Multi-route SPA navigation & URL query synchronization | Pin `^7.18.5` (v7 line) for rock-solid declarative SPA routing (`BrowserRouter` / `createBrowserRouter`) and `useSearchParams()` two-way URL state persistence (`?search=...&department=...&status=...&priority=...&sortBy=...&page=...`) without requiring framework/SSR mode. |
| **TanStack Query (`@tanstack/react-query`)** | `^5.107.1` | Server-state caching, background refetch & mutations | Eliminates manual `useEffect` fetch race conditions, provides `placeholderData: keepPreviousData` for flicker-free server pagination/filtering, and enables targeted cross-entity cache invalidation (`tasks` + `employees` + `dashboard`) after task assignment or status transitions. |
| **Vanilla CSS Modules + Custom Properties** | Native (`*.module.css` + `tokens.css`) | Apple HIG design system, light/dark themes, responsive layout | Zero runtime overhead, strict encapsulation, native support for Apple vibrancy (`backdrop-filter: blur(20px) saturate(180%)`), CSS `linear()` spring curves, and 100% compliance with the **no Tailwind / zero inline `style={{}}`** rules. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **`react-hook-form`** | `^7.92.0` | Performant form state & field error orchestration | All Employee & Task create/edit forms, conditional Leave Date inputs (`status === 'On Leave'`), and mapping backend `400`/`409` field errors via `setError()`. |
| **`@hookform/resolvers`** | `^7.0.6` | Connects Zod v4 schemas to React Hook Form | Every `useForm({ resolver: zodResolver(schema) })` call for client-side pre-flight validation matching backend rules. |
| **`lucide-react`** | `^1.73.0` | Crisp stroke icons (`strokeWidth={1.75}`) | Sidebar navigation, status/priority badges, filter toolbars, empty states, and mobile iOS tab bar icons matching Apple SF Symbols visual weight. |
| **`sonner`** | `^2.0.8` | Accessible stacked toast notifications | Surfacing exact backend business-rule messages (e.g., `"Employee already has 3 active tasks"`, `"Cannot delete employee with active tasks"`) styled via `toastOptions.classNames` (CSS Modules, no inline styles). |
| **`cors`** | `^2.8.6` | Cross-Origin Resource Sharing middleware | Allowing `CORS_ORIGIN` (`http://localhost:5173` + Vercel SPA domain) and exposing `Content-Disposition` header so frontend CSV downloads read server-generated filenames. |
| **`helmet`** | `^8.3.0` | HTTP security headers | Hardening Express responses (`crossOriginResourcePolicy: { policy: 'cross-origin' }` for dual-project Vercel deployment). |
| **`morgan`** | `^1.12.1` | Structured HTTP request logging | `'dev'` format in local development, `'tiny'` in serverless production, skipped when `NODE_ENV === 'test'`. |
| **`dotenv`** | `^18.0.10` | `.env` loader for local dev & CLI seed scripts | Loading `MONGODB_URI`, `PORT`, and `CORS_ORIGIN` consistently across `src/server.js` and `scripts/seed.js`. |
| **Custom RFC-4180 CSV Serializer** | Built-in (`src/utils/csv.js`) | Streaming filter-aware CSV export with UTF-8 BOM | **Preferred over external CSV packages** for `GET /api/tasks/export/csv`: streams Mongoose `.lean().cursor()` rows, prepends UTF-8 BOM (`\uFEFF`) for Excel compatibility, escapes quotes/commas/CRLF per RFC-4180, and neutralizes CSV formula injection (`=`, `+`, `-`, `@`). |
| **`@tanstack/react-query-devtools`** | `^5.107.1` | Query cache inspector (dev-only) | Mounted conditionally in `import.meta.env.DEV` to verify query key synchronization and cache invalidation. |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| **`vitest`** | `^5.1.0` | Unified test runner (`server/` & `client/`) | Native ESM, fast watch mode, compatible with Node `^24.0.0` (`v24.5.0`). Run backend integration suites sequentially or with isolated in-memory DB instances. |
| **`supertest`** | `^7.3.2` | HTTP assertions against Express `app` | Tests routes, status codes (`200`/`201`/`400`/`404`/`409`), headers (`text/csv`), and concurrent `Promise.all` race conditions without binding a TCP port. |
| **`mongodb-memory-server`** | `^11.3.0` | Ephemeral standalone `mongod` for backend tests | Downloads native macOS `arm64`/`x64` MongoDB binary (`engines: >=20.19.0`). Mirrors local standalone `mongod` (no replica set required), proving atomic conditional `$inc` works without transactions. |
| **`@testing-library/react` + `@testing-library/jest-dom`** | `^16.3.3` / `^7.0.1` | Component & form behavior testing on `client/` | Full React 19 peer support; verifies valid-next-status dropdowns, URL search param sync, and error rendering. |
| **`happy-dom`** | `^21.0.4` | DOM environment for client Vitest tests | **Use `happy-dom@^21.0.4` instead of `jsdom@31`!** `jsdom@30+` specifies `"node": "^22.22.2 \|\| ^24.15.0"`, triggering `EBADENGINE` on Node `v24.5.0`; `happy-dom` supports `node >= 20.0.0` and runs 3x faster. |
| **ESLint (`eslint` + `@eslint/js`)** | `^10.15.0` / `^10.0.1` | Flat-config (`eslint.config.js`) static analysis | Pair with `eslint-plugin-react-hooks@^7.1.1`, `eslint-plugin-react-refresh@^0.5.8`, `globals@^17.14.0`, and a custom `no-restricted-syntax` rule banning JSX `style` attributes (`JSXAttribute[name.name="style"]`) to enforce zero inline styles at lint time! |

## Architectural Stack Decisions

### 1. Backend: Express 5 (`^5.3.0`) vs Express 4 (`^4.22.3`) on Vercel Serverless

- **Native Async Error Forwarding:** Every controller in Roots EMS is `async` (querying Mongoose, enforcing leave windows, executing atomic capacity checks). Express 5 automatically catches rejected promises in both `async` route handlers and `async` middleware and forwards them to the 4-argument centralized error middleware `(err, req, res, next)`. Express 4 silently swallows unhandled promise rejections unless every handler is wrapped in `asyncHandler()` or patched with the unmaintained `express-async-errors` package, causing Vercel Serverless invocations to hang until `FUNCTION_INVOCATION_TIMEOUT`.
- **Vercel Serverless Compatibility:** Vercel's `@vercel/node` builder and Express zero-config adapter natively support Express 5 when `app` is default-exported from `server/api/index.js` without calling `app.listen()`.
- **Two Mandatory Express 5 Coding Conventions:**

### 2. Mongoose 8 (`^8.24.9`) Serverless Connection Caching & Local `mongod` Parity

- **Why Mongoose 8 over Mongoose 9:** `mongoose@^8.24.9` is rock-solid on Node 24 and `mongodb-memory-server@^11.3.0`, avoiding Mongoose 9 breaking hook/driver changes.
- **Global Serverless Connection Cache (`server/src/config/db.js`):**
- **Local Standalone `mongod` Compatibility:** Local `mongodb://127.0.0.1:27017/roots_ems` runs as a standalone node by default (where `session.startTransaction()` throws `Transaction numbers are only allowed on a replica set member or mongos`). Using atomic `Employee.findOneAndUpdate({ _id, status: 'Active', activeTaskCount: { $lt: 3 } }, { $inc: { activeTaskCount: 1 } }, { new: true })` + compensating `$inc: { activeTaskCount: -1 }` on task write failure works identically on local standalone `mongod`, `mongodb-memory-server`, and MongoDB Atlas!

### 3. CSV Generation: Custom RFC-4180 Serializer + UTF-8 BOM vs `fast-csv`

- **Excel Compatibility:** Prepending `res.write('\uFEFF')` with `Content-Type: text/csv; charset=utf-8` ensures Microsoft Excel on both macOS and Windows decodes UTF-8 international employee names and punctuation properly instead of rendering mojibake.
- **Security & Spec Compliance:** Escapes internal `"` as `""`, wraps fields containing `,`, `"`, `\r`, or `\n` in double quotes, prefixes formula-triggering characters (`=`, `+`, `-`, `@`, `\t`, `\r`) with a single quote `'` when appropriate to prevent CSV injection in spreadsheet apps, and streams row-by-row from a Mongoose cursor using the **exact same** `buildTaskFilterQuery()` used by `GET /api/tasks`.
- **Zero Bundler Friction:** Adds `0` external dependencies to the `@vercel/node` lambda bundle.

### 4. Frontend Styling & Motion: Apple HIG Vanilla CSS Modules + Native CSS Springs

- **Why Native CSS Springs over `framer-motion`:** `framer-motion` (`motion@^14.14.0`) animates by mutating `element.style.transform` and `element.style.opacity` as inline DOM attributes (`style="..."`) and adds ~34 kB gzipped JS. Because the Roots assignment rubric explicitly deducts points for inline styles and our ESLint config enforces zero `style` props, pure CSS Modules with `linear(...)` spring physics curves, `@starting-style` modal/drawer entry transitions, `backdrop-filter: blur(20px) saturate(180%)` vibrancy, and class-driven SVG `stroke-dashoffset` steps (`ringStep0`..`ringStep3` for `0/3`–`3/3` workload rings) deliver 120Hz compositor-accelerated Apple Sequoia / iPadOS 18 polish with zero inline styles anywhere in JSX or DOM.
- **Typography & Semantic Tokens:** `tokens.css` defines Apple system font stack (`-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', system-ui, sans-serif`), 8pt/4pt spacing scale, translucent surface layers, hairline borders (`0.5px` / `1px` `rgba`), and `[data-theme="light"]` / `[data-theme="dark"]` semantic tokens (`#0071E3` / `#0A84FF` accent blue, `#34C759` / `#30D158` green, `#FF9500` / `#FF9F0A` orange, `#FF3B30` / `#FF453A` red, `#5856D6` / `#5E5CE6` indigo).

### 5. Dual Vercel Project Deployment Architecture

- **Backend Serverless Entry (`server/api/index.js` + `server/vercel.json`):**
- **Frontend SPA Entry (`client/vercel.json`):**

## Installation

# ==========================================

# 1. Backend (server/) — Node.js 24 ESM

# ==========================================

# Core runtime dependencies

# Backend test & lint devDependencies

# ==========================================

# 2. Frontend (client/) — Vite 8 + React 19

# ==========================================

# Core SPA & UI dependencies

# Frontend build, test & lint devDependencies

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Express `^5.3.0`** | Express `^4.22.3` | Only if adding legacy Express 4 middleware that mutates `req.query` in-place (e.g., old `express-mongo-sanitize` v2). Not needed here because Zod v4 explicitly validates and strips every input field. |
| **Mongoose `^8.24.9`** | Mongoose `^9.12.1` | Greenfield apps not sharing test runners with `mongodb-memory-server` or once Mongoose 9 ecosystem plugins settle; `8.24.9` offers higher stability and predictable hook semantics for this assessment. |
| **Custom RFC-4180 CSV + `\uFEFF` BOM** | `fast-csv@^5.0.8` (`writeBOM: true`) | If complex stream transformation pipelines or CSV *parsing* (upload/import) were added in future milestones. |
| **Native CSS Springs (`linear()`) + CSS Modules** | `framer-motion@^14.14.0` (`motion`) | When complex FLIP layout-projection animations (`layoutId`) are mandatory AND DOM inline-style mutations (`element.style.transform`) are acceptable. |
| **Zod `^4.6.7`** | Zod `^3.25.76` | Only if copying legacy Zod v3 schemas verbatim that rely on `{ required_error, invalid_type_error }` instead of Zod v4's unified `{ error }` syntax. |
| **`happy-dom@^21.0.4`** | `jsdom@^29.1.1` | Only if testing obscure browser layout APIs missing in `happy-dom` (note: must avoid `jsdom@30+`/`31+` on Node `24.5.0` due to `^24.15.0` engine gate). |
| **Native `fetch` wrapper (`apiClient.js`)** | `axios@^1.x` | Only if XMLHttpRequest upload progress events are required; native `fetch` handles JSON errors, query params (`URLSearchParams`), `AbortSignal`, and CSV `Blob` downloads cleanly in ~45 lines. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **TailwindCSS / Inline `style={{ ... }}`** | Explicitly penalized in the Roots assignment rubric ("No inline styles") and prohibited by project styling constraints. | **Vanilla CSS Modules (`*.module.css`)** + centralized Apple HIG custom properties (`tokens.css`) + ESLint ban on JSX `style` prop. |
| **Multi-document MongoDB Transactions (`session.startTransaction()`)** | Fails immediately (`MongoServerError: Transaction numbers are only allowed on a replica set member`) on default local standalone `mongod` (`mongodb://127.0.0.1:27017`), breaking local evaluator runs. | **Single-document atomic conditional `$inc`** (`findOneAndUpdate({ _id, status: 'Active', activeTaskCount: { $lt: 3 } }, { $inc: { activeTaskCount: 1 } })`) + compensating rollback. |
| **`express-async-errors`** | Monkey-patches Express 4 router internals; incompatible with Express 5 and completely redundant. | **Express `^5.3.0`** native `async` promise rejection forwarding. |
| **`jsdom@30.x` / `jsdom@31.x`** | Declares `"engines": { "node": "^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0" }`, causing `EBADENGINE` warnings/failures on Node `v24.5.0`. | **`happy-dom@^21.0.4`** (`engines: ">=20.0.0"`) or `jsdom@^29.1.1` (`engines: "... \|\| >=24.0.0"`). |
| **`react-router@8.x` (`8.5.1`)** | Newly released major targeting framework/RSC changes (`react >= 19.2.7`); unnecessary churn for a classic Vite SPA. | **`react-router-dom@^7.18.5`** (proven v7 SPA router + `useSearchParams`). |
| **`nodemon`** | Legacy file watcher with unnecessary dependency tree (`chokidar`/`fsevents` issues). | **Node 24 built-in watcher:** `node --watch src/server.js`. |
| **Redux Toolkit / Zustand for API data** | Creates stale dual-source-of-truth bugs between employee capacity counts, task lists, and dashboard stats. | **`@tanstack/react-query@^5.107.1`** for server state + URL `searchParams` for filter/sort/pagination state. |
| **Legacy Vercel `builds` + `routes` in `vercel.json`** | Deprecated Vercel v2 config schema that triggers build warnings and disables modern framework optimizations. | **`rewrites`** in `server/vercel.json` (`/(.*) -> /api`) and `client/vercel.json` (`/(.*) -> /index.html`). |

## Stack Patterns by Variant

- `server` runs `node --watch src/server.js` on `http://localhost:5000` connected to `mongodb://127.0.0.1:27017/roots_ems`.
- `client` runs `vite` on `http://localhost:5173` with `server.proxy: { '/api': 'http://localhost:5000' }` — zero CORS preflights during local dev.
- Optional standalone `npm run seed` (`node scripts/seed.js`) populates realistic multi-department employees and tasks on demand; **never** import seed/mock data into Express or React runtime modules.
- `server` sets `MONGODB_URI` (Atlas `mongodb+srv://...`), `CORS_ORIGIN=https://<roots-client>.vercel.app`, and `NODE_ENV=production`.
- `cors` middleware sets `exposedHeaders: ['Content-Disposition']` so cross-origin `fetch()` CSV export preserves server-generated `tasks-export-YYYY-MM-DD.csv` filenames.
- `client` sets `VITE_API_BASE_URL=https://<roots-server>.vercel.app/api`.
- `mongodb-memory-server@^11.3.0` spins up an isolated ephemeral `mongod` instance in `beforeAll`, injects its URI into Mongoose, clears collections in `beforeEach`, and runs `supertest(app)` — including a `Promise.all` burst test proving 2 concurrent assignments to an employee at `2/3` active tasks allow **at most 1** (`201`) and reject the rest (`400`).

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `node@24.5.0` | All recommended packages + Vercel `"node": "24.x"` | Set `"engines": { "node": ">=22.12.0" }` or `"24.x"` in `package.json`; avoid `jsdom@30+` (`>=24.15.0`). |
| `express@^5.3.0` | `cors@^2.8.6`, `helmet@^8.3.0`, `morgan@^1.12.1`, `supertest@^7.3.2`, `@vercel/node` | Remember `req.query` is read-only in Express 5; store Zod-parsed query params on `req.validatedQuery`. |
| `mongoose@^8.24.9` | `mongodb-memory-server@^11.3.0`, Local MongoDB `7.0`/`8.0`, MongoDB Atlas | Disable command buffering (`bufferCommands: false`) and `await connectDB()` in Express middleware for serverless safety. |
| `zod@^4.6.7` | `@hookform/resolvers@^7.0.6`, `react-hook-form@^7.92.0` | `@hookform/resolvers@7` natively supports Zod v4 (`zodResolver` from `@hookform/resolvers/zod`). Use Zod v4 `{ error: '...' }` option instead of v3 `required_error`. |
| `react@^19.3.1` | `react-router-dom@^7.18.5`, `@tanstack/react-query@^5.107.1`, `lucide-react@^1.73.0`, `sonner@^2.0.8` | All peer dependencies explicitly include `^19.0.0` (`>=18`); clean `npm install` with zero warnings. |
| `vite@^8.3.8` | `@vitejs/plugin-react@^6.3.0`, `vitest@^5.1.0` | `vitest@5.1.0` declares `"vite": "^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0"`; full alignment across build and test toolchains. |
| `eslint@^10.15.0` | `@eslint/js@^10.0.1`, `eslint-plugin-react-hooks@^7.1.1`, `eslint-plugin-react-refresh@^0.5.8` | Uses modern `eslint.config.js` flat config (`engines: >=24` supported). |

## Sources

- **Live npm Registry Metadata (`npm view <pkg> version engines peerDependencies --json` on Node `v24.5.0` / npm `11.14.1`)** — Verified exact latest versions, `engines`, and `peerDependencies` for `express@5.3.0`, `express@4.22.3`, `mongoose@8.24.9`, `zod@4.6.7`, `vitest@5.1.0`, `supertest@7.3.2`, `mongodb-memory-server@11.3.0`, `vite@8.3.8`, `@vitejs/plugin-react@6.3.0`, `react@19.3.1`, `react-router-dom@7.18.5`, `@tanstack/react-query@5.107.1`, `react-hook-form@7.92.0`, `@hookform/resolvers@7.0.6`, `lucide-react@1.73.0`, `sonner@2.0.8`, `happy-dom@21.0.4`, and `jsdom@31.0.1` (HIGH confidence)
- **Express 5 Official Migration Guide (`expressjs.com/en/guide/migrating-5.html`)** — Verified automatic promise rejection forwarding, read-only `req.query` getter behavior, and `path-to-regexp` v8 wildcard rules (HIGH confidence)
- **Vercel Documentation: Express on Vercel & Node.js Runtime (`vercel.com/docs/frameworks/backend/express`, `vercel.com/docs/functions/runtimes/node-js`)** — Verified `engines.node: "24.x"`, default-exported Express 5 app in `api/index.js`, and `vercel.json` `rewrites` configuration (HIGH confidence)
- **Zod v4 & `@hookform/resolvers` Documentation (`zod.dev/v4`, `github.com/react-hook-form/resolvers`)** — Verified `zod@^4.0.0` peer compatibility with `@hookform/resolvers@^7.0.6` and unified `{ error }` customization syntax (HIGH confidence)
- **Typegoose `mongodb-memory-server` Documentation (`typegoose.github.io/mongodb-memory-server`)** — Verified v11+ Node 24 and macOS `arm64`/`x64` standalone binary behavior (HIGH confidence)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.agents/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
