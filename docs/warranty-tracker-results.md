# Warranty Tracker implementation results

Implemented after explicit user approval, including receipt-to-warranty cascading deletion. No commit, push or deployment was performed.

## Database changes

Applied migration `20261104171802_add_warranty_tracker` to the existing Supabase project `syvvocztwlvdiyzgwtxq`. The CLI-generated local migration file was aligned with the actual remote migration version. Its SQL exactly matches the approved proposal; the isolated verifier checks that equality on every run.

- New `public.warranties` table with independent product records, owner and receipt foreign keys, required calendar terms, optional exact expiry/notes, generated effective expiry, and timestamps.
- Two indexes: `(user_id, expiration_date, id)` and `(receipt_id)`.
- A SECURITY INVOKER timestamp trigger function with an empty search path and no client EXECUTE grant.
- Four authenticated RLS policies. Every operation checks warranty ownership and linked receipt ownership; UPDATE checks old and proposed rows.
- Explicit client grants: SELECT/DELETE plus column-restricted INSERT/UPDATE. Anonymous access, authenticated TRUNCATE, owner reassignment, timestamp writes and generated expiry writes are denied.
- Receipt deletion cascades to its warranties. Warranty deletion affects no receipt or transaction. Account deletion cascades its warranties.

There were no alterations to existing tables, existing RLS policies, Storage policies/configuration, authentication configuration, financial calculations, or existing financial records. Before/after metadata comparison confirmed existing policies, receipt columns and the private receipt bucket setting were identical. No user records were fetched for validation, and no synthetic test users/receipts were created in the live project.

## Implemented behavior

- Shield navigation entry below Receipts; full accessible name remains Warranties, with a compact mobile label.
- Optional Warranty Information during receipt upload; multiple products with independent start, duration/unit, calculated expiry, exact override and notes.
- Default start follows purchase date until explicitly edited. Missing receipt dates do not become invented purchase/start dates.
- Receipt library links into receipt-filtered warranty management. Add, edit and explicitly delete individual records without rewriting receipts or transactions.
- Status summary, search, status and receipt filters, purchase/start/expiry dates, days remaining, and private receipt access.
- Date-only arithmetic with destination-month clamping, leap-year support, inclusive 0–30 day expiring status, and refresh on day/visibility changes.
- Iris token-based surfaces, shield icons, glossy buttons, responsive cards/forms, labeled fields, announcements, focus and reduced-motion support.
- Independent warranty loading/errors so a warranty fetch failure does not hide finance summaries.
- Account state remounts on identity changes. A synchronous session generation invalidates old loads, mutations and signed-link responses, including logout and returning to the same user.
- After successful expense/receipt saving, a failed warranty batch can be retried without another expense/upload. Read-back of that new receipt detects a previously saved batch after a lost response.
- Receipt deletion fetches the current linked count before confirmation and fails closed when it cannot verify the count. Its warning states the cascade and retained transaction. Even a zero-count warning discloses that any linked warranties will be deleted.

## Files changed

| File | Change |
| --- | --- |
| `.gitignore` | Narrow migration SQL exception; ignore Supabase CLI temporary metadata |
| `package.json` | Discoverable test commands; no dependency changes |
| `README.md` | Feature use, migration reference, verification setup and limitations |
| `src/main.jsx` | Receipt upload/management integration, navigation, recovery, deletion warning and account lifecycle |
| `src/TransactionForm.jsx` | Slot for optional warranty fields inside receipt form |
| `src/Icon.jsx` | Original shield icon |
| `src/data.js` | Session guards between private storage and metadata operations |
| `src/warranties.js` | Calendar math, validation, status/filtering and deletion copy |
| `src/warranty-data.js` | User-scoped warranty CRUD/count and upload retry recovery |
| `src/account-scope.js` | Invalidatable account generation |
| `src/useWarranties.js` | Independent guarded loading and retry |
| `src/WarrantyForm.jsx` | Shared accessible warranty fields and multiple-product drafts |
| `src/Warranties.jsx` | Warranty dashboard and editor |
| `src/warranties.css` | Scoped Iris styling and responsive layouts |
| `supabase/migrations/20261104171802_add_warranty_tracker.sql` | Approved and applied migration |
| `scripts/fixtures/supabase-ui.js` | Synthetic receipts/warranties, CRUD, failures and auth changes |
| `scripts/verify-warranty-db.mjs` | Isolated SQL/RLS validation using pinned test-only PostgreSQL engine |
| `scripts/verify-warranty-ui.mjs` | Browser checks for feature and failure/session paths |
| `tests/warranties.test.js` | Date, validation, status, filtering and account generation tests |
| `tests/warranty-data.test.js` | Scoped CRUD, read-back recovery and blocked stale follow-up requests |
| `docs/warranty-tracker-proposal.md` | Reviewed proposal, updated approval/application status |
| `docs/warranty-tracker-results.md` | This report |

`package-lock.json`, Supabase client credentials/configuration and existing design tokens are unchanged. The temporary CLI and PostgreSQL test tools were not added to application dependencies or browser assets.

## Tests and security checks

| Check | Result |
| --- | --- |
| `npm.cmd test` | 26 automated tests pass: existing finance/public-env tests plus warranty date/data/session tests |
| `npm.cmd run test:db` | 12 isolated PostgreSQL checks pass; approved SQL executes and is identical to migration file |
| `npm.cmd run test:ui` | Existing 7 app views at 6 widths pass, including finance submission, contrast samples, focus, button states, reduced motion and auth surfaces |
| `npm.cmd run test:warranty-ui` | 13 browser scenarios pass, including forms/list at 320, 375, 430, 768, 1024 and 1440px |
| `npm.cmd run build` | Production build passes |
| `npm.cmd audit` and production-only audit | 0 vulnerabilities |
| Live Supabase metadata verification | RLS, policies, constraints, generated expiry, column privileges and trigger security verified |
| Before/after comparison | Existing policies, receipt columns and private bucket unchanged |
| Supabase security advisor | Only pre-existing leaked-password-protection warning; no new warranty findings |
| Supabase performance advisor | Existing receipt foreign-key index recommendation; informational unused new receipt index |
| Git/private-file checks | No staged changes; local environment, receipts/exports, bundles, dependencies and test-tool artifacts remain ignored |

Isolated database checks execute the real migration SQL with synthetic `auth.uid()` context, authenticated and anonymous roles, owner-scoped receipt policies, and broad default grants to ensure revocation works. They verify multiple products, ownership forgery/cross-user access/relinking denial, protected fields and TRUNCATE denial, trigger behavior, overrides, invalid terms, warranty deletion preservation, and receipt cascade deletion of multiple warranties. This is actual SQL/RLS execution, not frontend mocks.

Browser checks block external HTTPS and substitute an in-memory Supabase fixture. They verify independent multi-product dates, missing purchase-date validation, official override and reset, search/status, edit/delete cancellation, signed URL expiry, failed/lost-response recovery without duplicate financial writes, receipt-count failure handling, cascade warnings/deletion, independent loading errors/retry, delayed old-session loads and mutations, empty states, mobile overflow/touch-target size, focus and reduced motion. No browser runtime errors were recorded.

## Remaining limitations

- Live authenticated user CRUD, uploads, signed-link opening and two-account REST testing were not exercised against personal accounts. Live schema/grants/policy checks plus isolated PostgreSQL and browser tests passed; a signed-in acceptance test remains advisable before release.
- Supabase's existing [leaked password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains. Auth settings were not changed.
- The existing receipt-to-transaction foreign key lacks a covering index ([advisor details](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)). The new receipt index is currently marked unused because it is newly created; retain it to support cascade/lookups. No unrelated index changes were applied.
- Expense saving, Storage uploads, receipt metadata and warranty saving are separate requests. The implemented upload retry covers saved expense/receipt and ambiguous warranty response cases while the page remains open. Reloads and concurrent submissions from separate tabs can still require manual reconciliation; there is no distributed transaction or global idempotency key. Do not treat these requests as atomic.
- Optional drafts live only in memory. No local copies of receipt images or financial exports are persisted by this feature.
- Durations are limited to 1–1,200 months or 1–100 years; dates to years 0001–9999. Duration remains required with an exact override.
- AI recognition, reminders/notifications and claims remain intentionally unimplemented, with no placeholder action buttons.

The project remains local. The only remote write was the explicitly approved schema migration.
