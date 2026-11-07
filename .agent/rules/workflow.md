---
description: Autonomous Idea-to-Ship workflow decision matrix and clarification protocol
globs: ["**/*"]
---

# Autonomous Idea-to-Ship Workflow Rule

This rule governs how the agent responds to all user prompts in this project:

1. **Automatic Triage**:
   - Assess the user's prompt against the 5-phase Idea-to-Ship lifecycle (`grill-me` &rarr; `to-spec` &rarr; `to-tickets` &rarr; `tdd` &rarr; `improve-codebase-architecture`).
   - Automatically pick and apply the appropriate phase without requiring the user to type slash commands.

2. **Clarification Protocol (Never Guess)**:
   - When a prompt lacks required parameters, data models, or business logic specifications:
     - Activate the `grill-me` skill.
     - Formulate 2–3 sharp, multiple-choice or direct questions.
     - Wait for the user's answers before generating implementation code or plans.

3. **Execution & Verification Protocol**:
   - For bug fixes and features:
     - Run TDD (write/update test in `test_suite.js`, minimal code change, run test runner).
     - Run Playwright browser validation on live site (confirm element rendering, 0 console errors).
   - Before completing:
     - Synchronize `dist/` with `node build.js`.
     - Check git diff against specifications to prevent architectural drift.
