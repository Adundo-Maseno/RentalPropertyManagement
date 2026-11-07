---
name: idea-to-ship
description: End-to-end disciplined engineering workflow for coding agents adapted from Matt Pocock (AI Hero) and IBM Technology. Enforces the 5-step lifecycle: /grill-me (alignment interview), /to-spec (concrete specification), /to-tickets (vertical slicing), /tdd (test-driven implementation & Playwright verification), and /code-review (drift & architecture hygiene).
---

# Idea-to-Ship Agent Workflow

This skill encodes the disciplined, spec-driven engineering methodology taught by **Matt Pocock (AI Hero)** and **IBM Technology** for building robust software with autonomous coding agents without falling into the "vibe coding" trap.

## The 5 Core Disciplines

### 1. Alignment & The Grill Phase (`/grill-me`)
- **Principle**: Never start writing implementation code or generating a complex plan based on vague assumptions.
- **Action**: Actively interview the developer branch-by-branch.
  - Surface hidden constraints, edge cases, data flows, and role permissions (RBAC).
  - Clarify data shapes and UI expectations upfront.
  - Ask multiple-choice or direct questions to pin down requirements before opening source files.

### 2. Specification & Contracts (`/to-spec`)
- **Principle**: Agents need an immutable contract to execute against.
- **Action**: Synthesize the decisions from the alignment interview into an explicit, structured specification:
  - Database schema changes (DDL / migrations).
  - API endpoint signatures (method, path, request/response JSON).
  - UI states (empty, loading, populated, error).
  - Security & RBAC boundaries.

### 3. Task Slicing (`/to-tickets`)
- **Principle**: Operate strictly in the **"Smart Zone"**. Context window bloat degrades agent reasoning and produces hallucinations.
- **Action**: Slice the specification into small, self-contained vertical tickets:
  - Each ticket should touch only 1–3 closely coupled files.
  - Each ticket must have a clear "Definition of Done".
  - Execute tickets sequentially, verifying each before proceeding to the next.

### 4. Implementation with Immediate Verification Loop (`/tdd` & Playwright)
- **Principle**: If it isn't verified in runtime, it isn't finished.
- **Action**:
  - Write or update automated tests first (`test_suite.js`).
  - Implement the minimal, surgical code required to pass.
  - Run the test suite: verify all assertions pass.
  - Verify live UI and network interactions via Playwright (DOM snapshots, console logs, network response statuses).

### 5. Architectural Review & Drift Prevention (`/code-review`)
- **Principle**: Prevent codebase degradation and shallow abstraction creep over time.
- **Action**:
  - Compare the final diff against the original spec to ensure no scope drift or accidental bloat.
  - Synchronize build artifacts (`node build.js` to sync `public/` &rarr; `dist/`).
  - Commit with crisp, semantic commit messages and push cleanly.

