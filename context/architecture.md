# Architecture

_Last verified: 2026-11-21 from source code and read-only live database checks (schema, RLS, grants, Storage, migrations)._

## Stack

React 19.3 · Vite 7.3 · @supabase/supabase-js 2.118 · plain JavaScript (ESM, `.js`/`.jsx`) · plain CSS · node:test. Developed on Node 24. No router, no state library, no UI library.

## Runtime flow

```
index.html → src/main.jsx
  App: configured? (supabase.js requires an sb_publishable_ key) → getSession + onAuthStateChange
    each new identity → createAccountScope(userId) (account-scope.js); the old scope is invalidated synchronously
    no session → AuthScreen
    session    → <AccountApp key={scope.id}>  (remounts when the account changes)
        loadAccount() (data.js): paginated reads (500 rows per page) of transactions, receipts, monthly_budgets
        useWarranties() → warranty-data.js: warranties loaded independently
        Tabs (useState): Dashboard · Transactions · Add Transaction · Scan Receipt · Receipts · Warranties · Settings
```

## Module map

| File | Role |
|---|---|
| `src/main.jsx` | App, AuthScreen, AccountApp: all views and handlers inline (~100 very long lines) |
| `src/supabase.js` | Client, created only when a publishable key is present |
| `src/account-scope.js` | Account scope that can be invalidated, so late responses after a switch are discarded |
| `src/data.js` | Transactions, receipts and budget reads; Storage upload, signed URLs, delete |
| `src/transactions.js` | Pure logic: categories, `cents()`, `payload()`, filters, `summarize()`, keyword suggestions |
| `src/warranties.js` | Pure logic: calendar math, status, validation, filtering, delete warning text |
| `src/warranty-data.js` | Warranty CRUD, count, and `attach()` read-back retry (client passed in for tests) |
| `src/useWarranties.js` | Warranty loading hook with request versioning |
| `src/Warranties.jsx`, `src/WarrantyForm.jsx` | Warranty page, editor, reusable fields |
| `src/TransactionForm.jsx`, `src/Icon.jsx` | Shared form; inline SVG icons |
| `src/password.js` | Sign-up password rule mirroring the Supabase Auth policy (min 10, lower/upper/digit). Keep in sync with the dashboard. |
| `scripts/public-env.mjs` | Runs before Vite: allows only the 2 VITE_ variables, rejects secret or JWT shapes |
| `scripts/verify-*.mjs`, `scripts/fixtures/supabase-ui.js` | Isolated database (PGlite) and Edge-browser verifiers with a fake Supabase |

## Database (Supabase project ref `syvvocztwlvdiyzgwtxq`, ap-southeast-1, Postgres 17)

| Object | In repo? | Notes |
|---|---|---|
| `transactions` | Yes, `20261028053938_finflow_secure_finance_foundation.sql` | user_id, transaction_date, description, merchant, amount, kind, category, notes, payment_method, source, created_at |
| `receipts` | Yes (base migration) | user_id, transaction_id → transactions, storage_path, merchant, receipt_date, total, suggested_category, extraction_status |
| `monthly_budgets` | Yes (base migration) | user_id, month, category, amount. Only read by the app. |
| `warranties` | Yes, `supabase/migrations/20261104171802_add_warranty_tracker.sql` | Generated `expiration_date`; RLS checks owner **and** receipt owner; column-level grants; TRUNCATE and anon revoked; cascades from receipts and users |
| Storage `finflow-receipts` | Yes (base migration: bucket insert + 3 policies) | Private, 10 MB, JPEG/PNG/WEBP/PDF. Policies key on the first path segment = auth.uid() (per the Codex audit). |

**Migrations (both in the repo and applied live, order matters):**
1. `20261028053938_finflow_secure_finance_foundation.sql`: pgcrypto, the 3 base tables, indexes, 12 RLS policies, anon revoke + CRUD grant, the receipt bucket and 3 Storage policies. Retrieved read-only 2026-11-21; the body is byte-identical to the stored live statement (md5 `a547535a…`). No drift from the live schema. **Never edit it; add new migrations.**
2. `20261104171802_add_warranty_tracker.sql`: depends on `receipts` from #1. No objects overlap.
3. `20261121080550_revoke_unneeded_client_privileges.sql`: revokes TRUNCATE/TRIGGER/REFERENCES on the 3 base tables from `authenticated` (applied 2026-11-21, Step 2).

The base migration only grants `select, insert, update, delete`. The extra TRUNCATE/TRIGGER/REFERENCES came from **Supabase's default privileges** on the `public` schema and were removed by #3. **Those default privileges still apply to any future table**, so every new-table migration must `revoke all ... from anon, authenticated` and then grant only what it needs (as the warranty migration does).

**Client grants now (verified live 2026-11-21):** `authenticated` has `DELETE, INSERT, SELECT, UPDATE` on transactions, receipts and monthly_budgets; `DELETE, SELECT` + column-level INSERT/UPDATE on warranties. `anon` has nothing. `service_role` (server-only, bypasses RLS) keeps Supabase defaults; it's intentionally untouched.

**Verified live 2026-11-21:**
- `receipts.receipt_tx_own`: `(transaction_id, user_id) → transactions(id, user_id) ON DELETE SET NULL (transaction_id)`. Receipts survive deleting their transaction and can't point at another user's transaction. It has no covering index (INFO advisor).
- All `user_id` FKs → `auth.users ON DELETE CASCADE`.
- Amounts `numeric(12,2)`; transactions and receipts `> 0`, budgets `>= 0`. `currency = 'PHP'`. `monthly_budgets.month` must be the 1st of a month.
- `receipts.receipt_path_own`: storage_path must start with `user_id`. `extraction_status` ∈ pending, review, verified, failed.
- Storage has INSERT/SELECT/DELETE policies only (no UPDATE, so objects can't be overwritten or moved).
- No SECURITY DEFINER functions or views in `public`.

## Security model

- The browser holds only the publishable key. **RLS and Storage policies enforce authorization.** Frontend `.eq('user_id')` filters are for correctness only.
- Sessions persist in `localStorage` via supabase-js.
- Multi-step writes (transaction → upload → receipt row → warranties) are **not atomic**. There is a retry for saved-expense and saved-receipt states; orphans are possible after a reload.
- Receipt delete removes the Storage file before the database row (see the debt list in progress-tracker.md).

## Open security items (status as of 2026-11-21)

| Severity | Item | Status |
|---|---|---|
| Resolved | Project paused | Restored 2026-11-21 |
| Resolved | `authenticated` had TRUNCATE/TRIGGER/REFERENCES on the 3 original tables | Revoked 2026-11-21 (migration `20261121080550`), verified live |
| Accepted | Leaked-password protection disabled | **Accepted limitation, not resolved** (Pro-only; project stays on Free). Mitigated by the Supabase policy of min 10 + lower/upper/digit, mirrored in `src/password.js`. |
| Resolved | Base schema and policies not version-controlled | Base migration saved to repo 2026-11-21 |
| Low | No password reset; sessions persist on shared devices | Verified in code |
| Resolved | Account-switch race on delayed mutations | Verified in code and tests |
| Info | No secrets in Git history; 0 npm vulnerabilities | Verified |
