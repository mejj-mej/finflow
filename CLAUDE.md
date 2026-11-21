# FinFlow — Claude Code entry point

FinFlow is a portfolio personal-finance app: transactions in PHP, a monthly dashboard, private receipt uploads and a warranty tracker. Stack: React 19 + Vite 7 in plain JavaScript, plain CSS tokens, and Supabase (Auth, Postgres + RLS, private Storage).
Repo: `github.com/mejj-mej/finflow`, branch `main`. Owner: mejj-mej.

## Before any implementation: read all context files

Read every file below at the start of each session, before you write or change code. They hold the confirmed project state. Don't re-audit what they already record. Check whether a recorded fact is still true only when your task depends on it.

1. [context/progress-tracker.md](context/progress-tracker.md): **central record**. Current work, blockers, next steps.
2. [context/project-overview.md](context/project-overview.md): what FinFlow is and the status of each feature.
3. [context/architecture.md](context/architecture.md): code structure, data flow, database, security model.
4. [context/ui-context.md](context/ui-context.md): Iris Chromatic Editorial Fintech design system.
5. [context/code-standards.md](context/code-standards.md): conventions, patterns that must be kept, testing.
6. [context/ai-workflow-rules.md](context/ai-workflow-rules.md): approval gates, safety rules, how to update docs.

Background evidence (historical, don't edit): [context/audit-2026-11-21.md](context/audit-2026-11-21.md), plus `docs/security-audit-2026-11-04.md`, `docs/warranty-tracker-*.md` and `docs/chromatic-redesign.md` from the Codex era.

## After meaningful changes: update the docs

- Always update `context/progress-tracker.md`: move tasks between sections, log what was verified, and record new blockers.
- Update whichever other context file the change affects: architecture, UI, standards or overview.
- Mark anything you didn't actually run or observe as **unverified**.

## Rules that can't be broken (details in ai-workflow-rules.md)

- **Explicit approval required** for: commits, pushes, pulls, migrations, Supabase setting or policy changes, dependency installs, deleting files, history rewrites, deployment, and application code changes the owner hasn't approved.
- Never print, log or commit secrets, `.env.local` values, signed URLs or real financial data.
- RLS is the security boundary. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` may reach the browser.
- Keep the Iris design identity. Use tokens, not raw hex or pixel values.
- Every async mutation must respect the account scope (`scope.assert()` / `scope.current()`).

## Checks

`npm test` · `npm run test:db` · `npm run build` · `npm audit`. There is no lint or type check yet.
