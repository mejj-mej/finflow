# AI workflow rules (for Claude Code and any AI assistant)

## Session start

1. Read `CLAUDE.md` and **every file in `context/`** before implementing anything.
2. Check that `progress-tracker.md` still matches reality (`git status`, current branch, whether `origin/main` has moved). Record any differences you find.
3. Don't repeat the full audit. Re-check only the facts your task depends on, and mark old facts as re-verified or changed.

## Approval gates: always ask the owner first

- Application source changes the owner hasn't approved
- `git commit`, `push`, `pull`, `merge`, `rebase`, `reset`, amend, force operations, history rewrites
- Applying migrations, running write SQL, changing Supabase Auth, Storage or policy settings, restoring or pausing the project
- Installing, upgrading or removing dependencies
- Deleting or overwriting files (review existing documentation before replacing it)
- Deployment or publishing
- Rotating credentials

Approval for one action doesn't carry over to the next one.

## Safety rules

- Never print, log, commit or send secret values, `.env.local` contents, tokens or signed URLs. Refer to them as `<redacted>`.
- Never use real financial records for testing. Use synthetic fixtures and isolated databases.
- Read-only Supabase inspection (metadata queries, advisors) is fine. Data-changing SQL needs approval.
- Never disable RLS or widen grants to work around a frontend bug.
- Don't invent features or claim something works without verifying it. Say what was and wasn't run.
- Report findings with severity (Critical / High / Medium / Low / Informational), and keep verified problems separate from recommendations.

## Way of working

- Propose → get approval → implement → verify → update docs.
- Explain decisions in beginner-friendly language. The owner wants mentoring, not just code.
- Prefer small, reviewable changes. Keep refactors separate from behaviour changes.
- Keep the Iris design identity in every UI change.

## Required documentation updates after meaningful changes

| Change type | Update |
|---|---|
| Any task finished, started, blocked | `progress-tracker.md` (always) |
| Feature status changes | `project-overview.md` feature table |
| New module, table, policy or data flow | `architecture.md` |
| Visual or token change | `ui-context.md` |
| New convention or test command | `code-standards.md` |
| New rule from the owner | this file |

Every entry gets a date (YYYY-MM-DD) and says how it was verified (command, test or observation) or marks it **unverified**.
