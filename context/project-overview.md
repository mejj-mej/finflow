# Project overview

_Last verified: 2026-11-21 (handoff audit). Source: [audit-2026-11-21.md](audit-2026-11-21.md)._

## What FinFlow is

A personal-finance web app and **portfolio project**. It demonstrates frontend work, Supabase backend integration, database design, authentication, UI/UX, responsive design, security-conscious engineering and AI-assisted development. It should be treated as an evolving portfolio app, not an enterprise banking product, but data ownership and security still matter.

Currency is PHP (Philippine pesos, `en-PH` formatting). Development moved from OpenAI Codex to Claude Code in November 2026.

## Product decisions already made (keep these)

- Every receipt is reviewed by hand before it is saved. **No AI extraction is active.** Category suggestions are keyword rules and are labelled "not AI".
- Receipts are private: per-user Storage folders, random file names, and 60-second signed URLs for viewing.
- Warranties belong to a receipt. One receipt can have several products. Deleting a receipt deletes its warranties; deleting a warranty never touches the receipt or transaction.
- Income means money actually received (net pay). Transfers between your own accounts aren't income, and unpaid invoices aren't income.
- Expense and income categories are separate lists. Legacy categories are kept when an old record is edited.
- Future AI work goes only through an authenticated backend function, and the user must confirm every draft (see `SECURITY.md`).

## Feature status

| Feature | Status | Notes |
|---|---|---|
| Dashboard metrics | Partially complete | Income, spending and net are correct. The budget card needs `monthly_budgets` rows, and **no UI creates them**. |
| Charts | Partially complete | CSS category bars only. No trends. |
| Transactions CRUD, filters, CSV | Complete in code; live unverified | |
| Receipts upload, view, delete | Complete in code; live unverified | |
| Warranty Tracker | Complete in code; live unverified | Migration recorded as applied; not confirmed live. |
| Auth sign in / up / out | Partially complete | Sign-up enforces the Supabase policy (min 10 + lowercase, uppercase, digit) with a live hint (`src/password.js`). No password reset, change password or account deletion. Leaked-password protection is an accepted limitation (Pro-only). |
| Account-switch safety | Complete | Account scope + remount; unit tested. |
| Supabase integration | Complete; live authenticated tests pending | Project active. All 3 migrations in the repo and identical to live. RLS, policies, Storage and least-privilege grants verified 2026-11-21. |
| Design system | Mostly complete | Token gaps are listed in ui-context.md. |
| Responsive layout | Complete (per isolated browser scripts) | |
| Testing | Partially complete | No lint, no type check, no live end-to-end test. |
| Documentation | Partially complete | Local README is behind the remote; SECURITY.md names the old repo. |

## Explicitly not implemented yet

AI OCR or extraction, AI categorization, warranty reminders and notifications, bank connections, income-document processing, deployment, monitoring.
