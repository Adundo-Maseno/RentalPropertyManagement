# BomaSphere PMS — Agent Autonomous Workflow & Operating Contract

## 1. Baseline Workflow Philosophy (Idea-to-Ship)
The 5-stage engineering lifecycle adapted from **Matt Pocock (AI Hero)** and **IBM Technology** is the mandatory, default operating workflow for all coding and refactoring tasks.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Phase 1: Grill │ ──> │ Phase 2: To-Spec│ ──> │Phase 3: Tickets │ ──> │   Phase 4: TDD  │ ──> │ Phase 5: Review │
│ (Align & Probe) │     │ (Tech Contract) │     │  (Smart Zone)   │     │ & Verification  │     │   & Hygiene     │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

The agent autonomously determines which phase to activate based on the nature of the user's request.

---

## 2. Autonomous Decision Matrix

| Incoming Task Characteristic | Agent Autonomous Action | Active Skill |
|---|---|---|
| **Vague, incomplete, or multiple architectural choices** | **STOP & GRILL**: Ask 2–3 sharp, multiple-choice or direct questions to resolve edge cases, data structures, or role permissions before touching code. | `/grill-me` |
| **New feature, data model change, or API addition** | **SPECIFY**: Write a concrete technical contract: SQL DDL, API request/response JSON signatures, UI states, and RBAC rules. | `/to-spec` |
| **Multi-step or complex implementation** | **SLICE**: Break the spec into small vertical slices (touching 1–3 files each) with explicit acceptance criteria to stay in the "Smart Zone". | `/to-tickets` |
| **Bug fix, feature implementation, or logic update** | **TDD & PLAYWRIGHT LOOP**: Add/update test in `test_suite.js` first, apply minimal code change, run automated test suite, and verify live via Playwright browser inspection (zero console errors). | `/tdd` |
| **Finishing a task, milestone, or refactor** | **HYGIENE & DRIFT CHECK**: Compare diff against original spec, sync `public/` &rarr; `dist/` with `node build.js`, run test suite, and commit with clean semantic messages. | `/improve-codebase-architecture` |

---

## 3. Strict Operating Invariants for BomaSphere PMS

1. **Ask When Not Clear**: Never guess intent or make silent assumptions about business logic, data models, or permissions. If anything is ambiguous, pause and ask the user for clarification.
2. **Dual-Backend Synchronization**:
   - Every API endpoint implemented in [`functions/api/[[catchall]].js`](file:///c:/Users/User/OneDrive%20-%20Agri%20Experience%20Limited/RentalPropertyManagement/functions/api/[[catchall]].js) (Cloudflare D1 edge) must also be mirrored in [`server.js`](file:///c:/Users/User/OneDrive%20-%20Agri%20Experience%20Limited/RentalPropertyManagement/server.js) (Node.js local runtime) and vice versa.
3. **Database Schema & D1 Migrations**:
   - All table definitions and column migrations must be included in `D1_SCHEMA_SQL` and `ensureD1Schema(db)` in `functions/api/[[catchall]].js` as well as [`d1_schema.sql`](file:///c:/Users/User/OneDrive%20-%20Agri%20Experience%20Limited/RentalPropertyManagement/d1_schema.sql) and [`db.js`](file:///c:/Users/User/OneDrive%20-%20Agri%20Experience%20Limited/RentalPropertyManagement/db.js).
4. **Build & Test Gates**:
   - Always run `node build.js` after editing files in `public/` to keep `dist/` synchronized.
   - Always verify that all tests pass (`node test_suite.js`) before pushing code.
5. **Runtime Verification Gate (Playwright)**:
   - For all user-facing changes, verify the live deployment on `https://rentalpropertymanagement.pages.dev/` using Playwright:
     - Check UI rendering.
     - Inspect `browser_console_messages` to ensure zero uncaught errors.
     - Verify API network responses return 200/201.

