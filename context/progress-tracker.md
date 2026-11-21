# Progress tracker (central record)

Update this file after every meaningful change. Date every entry. Say how it was verified, or mark it **unverified**.

_Last updated: 2026-11-21. Context system created after the Codex → Claude Code handoff audit._

## Snapshot

| Item | State (2026-11-21) |
|---|---|
| Local branch | Feature branch `chore/handoff-db-auth-policy` @ `5d6ec50` (3 commits ahead of `main`), **not merged, not pushed** |
| `main` | Untouched @ `69cb013`, in sync with `origin/main` |
| Remote | `origin` = github.com/mejj-mej/finflow |
| Supabase | Project `syvvocztwlvdiyzgwtxq` **ACTIVE_HEALTHY** (restored by owner 2026-11-21); database reachable |
| Tests | `npm test` 32/32 · `npm run test:db` 12/12 · `test:ui` pass · `test:warranty-ui` 13/13 · build passes · `npm audit` 0 vulnerabilities (as of 2026-11-21) |
| Not run | Live authenticated tests (sign-up, two-account CRUD and Storage) |

## Blockers

1. ~~Supabase project paused~~: resolved 2026-11-21 (owner restored it; status ACTIVE_HEALTHY, SQL queries answer).
2. ~~Local behind origin~~: resolved 2026-11-21 (`git pull --ff-only` → `69cb013`).
3. ~~Git email check~~: resolved 2026-11-21. The owner confirmed the Git author email is verified on GitHub.

## Current work

- [x] **Password policy (Option B + C docs) — done 2026-11-21, committed as `5d6ec50` on `chore/handoff-db-auth-policy` (not merged or pushed).** Owner set Supabase to min 10 chars + lowercase, uppercase and digits.
  - [x] `src/password.js` (single source of the rule) + sign-up validation in `src/main.jsx` (sign-in unchanged at 6)
  - [x] Live checklist hint on sign-up (`.password-rules` in `src/phase2.css`); Supabase `weak_password` mapped to a plain message
  - [x] `tests/password.test.js` (6 tests)
  - [x] `SECURITY.md`: password policy + leaked-password protection as an **accepted limitation**
  - [ ] **Not verified live:** a real sign-up against Supabase wasn't performed (it would create an account). Recommended: try one test sign-up with a weak and then a valid password.

## Planned (owner requests)

- [ ] **Payment method as a dropdown instead of free text** (requested 2026-11-21, not started; needs approval before implementation)
  - Today: free-text input in `src/TransactionForm.jsx` (optional, max 100 chars) → `transactions.payment_method` (nullable `text`, no constraint).
  - Owner to confirm the option list. Suggested: Cash, Debit card, Credit card, Bank transfer, E-wallet (GCash/Maya), Other.
  - Keep it optional (a "Not specified" choice) and keep existing free-text values when editing old records, the same way legacy categories are kept.
  - Probably no migration needed (column stays `text`). A database CHECK constraint would be a separate decision, since it would reject existing free-text values.
  - Put the option list in a pure module with unit tests, like the category lists in `src/transactions.js`.
- [ ] **Sign-up doesn't move on after success; the button can be clicked again and again** (bug reported by owner 2026-11-21, not started; needs approval)
  - Cause (from code, `AuthScreen` in `src/main.jsx`): after `supabase.auth.signUp` returns with no session (email confirmation on), the form stays filled in on the same screen. The only feedback is a small `setInfo('Check your email…')` notice under the form. `working` resets to false, so **Sign up** is enabled again, and each click sends another sign-up request (resent confirmation emails; Supabase may rate-limit with 429).
  - Wanted: after a successful sign-up, replace the form with a clear "Check your email" confirmation screen showing the address it was sent to, plus actions: "Back to sign in" and optionally a "Resend email" with a cooldown. Disable or remove the Sign up button so it can't be submitted twice. Clear the password from state.
  - Edge cases: if confirmation is disabled, Supabase returns a session and the user is signed in directly (keep that). For an existing email, Supabase may return success without sending (anti-enumeration), so the screen should use neutral wording ("If this address can be registered, we've sent a link"). Show rate-limit errors in plain language.
  - Tests: browser fixture scenario (sign-up success → confirmation screen, no resubmission) in `scripts/verify-ui.mjs`. Optionally pull a small pure helper for the result state into its own unit-tested module.

## Completed

| Date | Work | Verified by |
|---|---|---|
| 2026-11-04 | Initial project (Codex): auth, transactions, receipts, dashboard, CSV, env guard | Codex docs; code read 2026-11-21 |
| 2026-11-05 | Warranty Tracker: migration, UI, account-scope hardening (Codex) | 26 unit + 12 PGlite tests 2026-11-21; live **unverified** |
| 2026-11-05 | Remote README quick-start commit `69cb013` | GitHub API |
| 2026-11-21 | Read-only handoff audit ([audit-2026-11-21.md](audit-2026-11-21.md)) | Tests, build, audit, history secret scan |
| 2026-11-21 | Context system: `CLAUDE.md` + `context/*` | Files created; no source changes |
| 2026-11-21 | Synced local to `origin/main` (`69cb013`) | `git pull --ff-only` |
| 2026-11-21 | Base schema migration saved to the repo | md5 match, PGlite replay 15/15 |
| 2026-11-21 | Revoked unneeded client privileges (Step 2) | PGlite replay 19/19 before apply; live grants re-queried after |
| 2026-11-21 | Sign-up password policy + hint; SECURITY.md accepted limitation | `npm test` 32/32, `test:ui` pass, `test:warranty-ui` 13/13, fixture screenshots at 1440/375 |
| 2026-11-21 | Committed on feature branch `chore/handoff-db-auth-policy` (**not merged into `main`, not pushed**): `fa513f6` docs: add Claude Code project context and progress tracker · `9fd2f57` chore(db): version base schema and revoke unneeded client privileges · `5d6ec50` feat(auth): enforce Supabase password policy on sign-up | `git log`; pre-commit review passed |

## Needs verification (once the project is restored)

- [x] Warranty migration present in the live migration list: verified 2026-11-21 (`20261104171802_add_warranty_tracker`)
- [x] RLS enabled on transactions, receipts, monthly_budgets, warranties: verified 2026-11-21 (pg_class.relrowsecurity)
- [x] Base migration `20261028053938_finflow_secure_finance_foundation` saved to `supabase/migrations/` on 2026-11-21 (approved Step 1). Byte-identical to the live copy (md5), no drift, replays cleanly before the warranty migration on PGlite (15 checks). Not executed against Supabase.
- [x] `receipts.transaction_id` delete behaviour: verified 2026-11-21. Composite FK `receipt_tx_own (transaction_id, user_id) → transactions(id, user_id) ON DELETE SET NULL (transaction_id)`. Receipts survive deleting their transaction (UI promise holds), and a receipt can't link to another user's transaction.
- [x] Authenticated grants: **FIXED 2026-11-21** (Step 2, migration `20261121080550`). Now exactly DELETE, INSERT, SELECT, UPDATE on transactions, receipts, monthly_budgets (was +REFERENCES, TRIGGER, TRUNCATE). `anon` has no public table grants. Warranties is correctly least-privilege (table SELECT/DELETE + column INSERT/UPDATE).
- [x] Leaked-password protection: verified 2026-11-21 via security advisor. **Still DISABLED** (WARN). It's the only security advisor finding.
- [x] Storage: verified 2026-11-21. `finflow-receipts` private, 10 MB, JPEG/PNG/WEBP/PDF. INSERT/SELECT/DELETE policies require bucket + first folder = auth.uid(). No UPDATE policy, so objects can't be overwritten or moved.
- [x] Policies: verified 2026-11-21. 16 public policies (4 per table, all `authenticated`, `(select auth.uid()) = user_id`, UPDATE has USING + WITH CHECK; warranties also check receipt ownership) + 3 Storage policies.
- [x] No SECURITY DEFINER functions or views in public: verified 2026-11-21 (only `finflow_warranty_timestamps`, invoker).
- [x] Base-table constraints: verified 2026-11-21. Amounts are `numeric(12,2)` with `> 0` (budgets `>= 0`); receipts `receipt_path_own` forces storage_path to start with user_id. The `summarize()` crash on invalid amounts **can't happen** with these constraints.
- [ ] Two-account live CRUD, upload and signed-URL test: **writes data**, needs approval and dedicated test accounts.

## Known technical debt and bugs

| Priority | Item |
|---|---|
| ~~High~~ | ~~Base schema not in repo~~: resolved 2026-11-21 (base migration saved). Remaining gap: Auth settings (email confirmation, leaked-password protection) live only in the dashboard. |
| Low | `transactions.updated_at` has no trigger, so it never changes after insert (found while inspecting the base migration) |
| Low | `npm run test:db` checks only the warranty migration; a full-replay check (base + warranty) exists only as a scratchpad script. Consider adding it to `scripts/` (needs approval). |
| High | `main.jsx` written as one giant minified-style file; no ESLint or Prettier |
| Medium | No router: no URLs, back button doesn't work, refresh goes back to Dashboard |
| Medium | Budget card has no UI for creating budgets |
| Medium | Editing a transaction doesn't update its receipt's merchant, date or total, so warranty "Purchased" dates go stale |
| Medium | No password reset, change password or account deletion |
| Low | Receipt delete removes the file before the row, so a row can be left pointing at a missing file |
| ~~Medium~~ | ~~`authenticated` TRUNCATE/TRIGGER/REFERENCES on base tables~~: resolved 2026-11-21 (Step 2) |
| Info | Supabase default privileges still grant everything on **new** public tables; each new-table migration must revoke and re-grant explicitly |
| Accepted | Leaked-password protection disabled: **accepted limitation, not resolved** (2026-11-21). Needs Supabase Pro; the project stays on Free. Mitigated by the 10-char + lower/upper/digit policy. The advisor warning will remain. Revisit before real users. See `SECURITY.md`. |
| Low | `receipts` FK `receipt_tx_own` has no covering index (performance advisor, INFO). `warranties_receipt_idx` reported unused: keep it, it supports the cascade. |
| Low | Header month picker and "+ Add transaction" shown on every tab; "Loading your account?" typo; hardcoded "CLOUD CONNECTED" |
| Low | Design token gaps (see ui-context.md); "AI" branding with no AI |
| Low | SECURITY.md and the Codex audit name the old repo `mejj-mej/-finflow`; local README is out of date |
| Info | Warranty receipt filter stays set between visits; single 494 kB JS chunk |

## Roadmap (next steps, in order; each needs approval)

**Stage 1: Stabilize and make it reproducible**
1. Owner restores Supabase → approved `git pull` → re-run checks.
2. ~~Read-only verification of the "Needs verification" list~~: done 2026-11-21.
3. ~~Baseline migration of the existing schema~~: done 2026-11-21 (Step 1).
4. ~~Step 2: grant-reduction migration~~: done 2026-11-21. ~~Step 3~~: resolved as Option B + C on 2026-11-21 (stronger password rules + documented accepted limitation; stays on Free).
5. ESLint + Prettier, then split `main.jsx` into pages and hooks (no behaviour change).
6. React Router; password reset; fixes for stale receipt data, the header controls, the typo and the hardcoded status text.

**Stage 2: Finish the core product**
1. Budget create and edit, with a budget vs. actual view.
2. Real charts (monthly trend, category breakdown) in Iris tokens.
3. Warranty reminders: in-app first, then email via `pg_cron` + Edge Function.
4. Two-account integration tests on a Supabase branch or local stack.

**Stage 3: AI features, done safely**
1. Receipt extraction Edge Function (vision model) → draft → user confirms.
2. Warranty term extraction.
3. AI category suggestions, always confirmed by the user.

## Change log

- 2026-11-21: Tracker created.
- 2026-11-21: Owner restored Supabase. Fast-forward pull to `69cb013` (README only); untracked context files preserved. Live check: 2 migrations listed, RLS on all 4 tables. No settings or migrations changed.
- 2026-11-21: Read-only live verification (grants, FKs, policies, Storage, constraints, functions, advisors). Two security items confirmed open; receipt cascade confirmed; dashboard-crash concern ruled out. Base migration SQL is stored on the server (can be pulled). No writes.
- 2026-11-21: Step 1 (approved): saved `supabase/migrations/20261028053938_finflow_secure_finance_foundation.sql`. Checks: md5 match with live, no drift, no duplicate objects, PGlite replay 15/15, `npm test` 26/26, `test:db` 12/12, build passes. Live migration list unchanged (2). Not committed.
- 2026-11-21: Step 2 (approved): applied `revoke truncate, trigger, references ... from authenticated` on the 3 base tables as live migration `20261121080550_revoke_unneeded_client_privileges`; local file renamed to match. Before apply: PGlite replay 19/19 (CRUD still works, TRUNCATE denied). After apply: grants exactly CRUD, 19 policies, RLS on 4 tables, warranty column grants unchanged; security advisor shows only leaked-password warning. `npm test` 26/26, `test:db` 12/12, build passes. No data touched. Not committed.
- 2026-11-21: Step 3 approved but blocked. The org is on the Free plan and leaked-password protection is Pro-only; MCP has no Auth-config tool. Nothing changed.
- 2026-11-21: Owner chose Option B (stronger password rules, configured by the owner in the dashboard) + Option C (document as an accepted limitation). Stays on Free plan. Waiting for the owner's exact rules before the code change.
- 2026-11-21: Owner confirmed the Supabase policy (min 10; lowercase, uppercase, digits). Added `src/password.js`, sign-up validation + live hint in `src/main.jsx`, `.password-rules` CSS, `tests/password.test.js`, and a SECURITY.md section. Checks: `npm test` 32/32, `test:db` 12/12, build passes, `test:ui` pass (6 widths, 0 runtime errors), `test:warranty-ui` 13/13, fixture screenshots confirm the hint at 1440/375 with no overflow and sign-in unchanged. Live sign-up not exercised. No Supabase changes. Not committed.
- 2026-11-21: Pre-commit review: migrations byte-identical to live (all 3 md5s), diff clean, no secrets, tests 32/32 + 12/12 + replay 19/19, build passes, audit 0. Fixed stale doc statements in project-overview.md and architecture.md. Ready to commit pending owner approval.
- 2026-11-21: Committed (owner-approved) on new branch `chore/handoff-db-auth-policy`: `fa513f6` (docs), `9fd2f57` (migrations), `5d6ec50` (auth password policy). The earlier "Not committed" notes in this log describe the state before these commits. **Not merged into `main`, not pushed.** Owner confirmed the Git author email is verified on GitHub. Leaked-password protection stays **Accepted** (not resolved); the live Supabase sign-up test is still pending.
