# FinFlow AI — Phase 2 (React + Vite + Supabase)

A mobile-first PHP finance tracker connected to the private **FinFlow AI** Supabase project `syvvocztwlvdiyzgwtxq` in Singapore. The app has sign-in/sign-up, user-scoped cloud transactions, private receipt uploads, dashboard summaries, simple keyword-based categories, and CSV export.

## Run locally in VS Code

1. Install Node.js compatible with Vite 7 and open this folder in VS Code.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. In [Supabase Dashboard → Project → Settings → API Keys](https://supabase.com/dashboard/project/syvvocztwlvdiyzgwtxq/settings/api-keys), copy the **publishable** key (`sb_publishable_…`) into `VITE_SUPABASE_PUBLISHABLE_KEY`. Set VITE_SUPABASE_URL to your project URL; the example file contains placeholders only. **Never** enter a secret, service_role, or `sb_secret_` key into a `VITE_` variable.
5. Run `npm run dev`; open the loopback URL shown (usually `http://localhost:5173`).
6. Sign up with email and password. Depending on your project Auth settings, verify the email before signing in. Supabase Auth's site URL/redirect URLs must include your local dev URL for email confirmation to land on the app.
7. Add a test expense without an image, then add a test expense with a small receipt photo. Check the Dashboard, Transactions, and Receipts tabs.
8. To verify bundling: `npm run build`. This is not a deployment.

## Actual features

- Password-based authentication via Supabase Auth. The session is managed by `supabase-js`.
- Expenses/income saved in `public.transactions` and retrieved from Supabase; dashboard sums only the selected month.
- Manual categorization and keyword-based merchant suggestions (**not AI**).
- Image/JPG/PNG/WEBP or PDF upload up to 10 MB to bucket `finflow-receipts` using an authenticated user-ID folder and a random filename. The app creates a linked `public.receipts` record.
- Short-lived 60-second signed URL to view private receipts, and an explicit delete action for receipt files and metadata.
- CSV export. No silent import of prior browser-only records.

## Security model and limitations

Supabase row-level-security (RLS) restricts `transactions`, `receipts` and `monthly_budgets` by `auth.uid()`. The storage bucket is private and per-user folder policies limit file access. Only the **publishable** API key belongs in browser configuration; RLS is the actual data-access security boundary. Never use a secret/service-role key in browser code.

**Not implemented:** AI OCR or automatic receipt extraction, real categorization model, bank integrations, cross-account security penetration tests, production monitoring, and deployment. This is still a learning MVP. Don't upload sensitive IDs, card numbers, or bank credentials. Receipt content can include personal information; use only material you are comfortable placing in your own Supabase project.

The receipt upload and transaction insert are separate API calls, not one atomic database transaction. If a receipt metadata insert fails, the UI reports it; an uploaded file may require manual cleanup. Never assume that a failed workflow means no file was stored.

The database currently stores `receipts.extraction_status = pending` for each upload. This does **not** mean an AI process is running. It means the receipt awaits future extraction/review functionality.

Auth email confirmation and redirect configuration may require a dashboard adjustment; the starter does not modify Auth project settings.

## Roadmap

1. Test login, RLS isolation with two accounts, private file upload/read/delete.
2. Build a review queue for receipts and handle orphaned uploads/transactions.
3. Add a protected Edge Function for vision OCR, structured validation, data-retention considerations, and duplicate detection.
4. Require user confirmation before automatically posting uncertain receipt entries.

No existing Supabase data was imported or overwritten. Project is local only; do not deploy until security and QA testing is complete.

## Transaction workflow update

Manual entry is available through **Add transaction** in the header and transaction history. Expense and Income use separate category lists; payment method and notes are optional. Amounts must be positive with at most two decimal places. Existing category names are preserved during editing. Internal account transfers are not income categories.

**Scan Receipt** accepts images or PDFs, offers a local preview, and requires manual verification before saving an expense. Category suggestions use explicit merchant keyword rules, not AI. No OCR service or fabricated extraction is present. Manually reviewed attachments are stored with `extraction_status = verified`. Historical pending statuses do not imply an active processing job.

The dashboard uses the selected month for income, expenses, net cash flow, category spending and recent transactions. Remaining budget is the sum of that month's category budget rows minus total expenses. No budget rows displays **Not set**. This is not a bank balance. Reads paginate rather than silently truncating at 1,000 transactions.

The history combines month, type, category and merchant/description search. Editing preserves source and ownership; deletion requires confirmation and leaves attached receipts in the private library. Successful saves update local data and reload the account. An immediate submission lock blocks repeated clicks. If receipt attachment fails after the expense saves, the same expense is reused on attachment retry. These separate requests are not atomic; network interruptions or a page reload can still require reconciliation. Database idempotency and orphan reconciliation remain future backend work.

### Verification for this update

- `node --test`: 9 passing domain tests covering manual payloads, precision, category separation, legacy edits, calendar dates, month totals, combined filters and empty accounts.
- `npm.cmd run build`: production bundle succeeds.
- Read-only schema inspection confirmed existing payment-method support, valid receipt status values, ownership policies on all three tables, and a private receipt bucket. No migrations, policy changes, storage configuration changes or financial-record mutations were performed.
- No authenticated browser session was used. Login, real transaction writes, signed receipt access, upload/delete and visual mobile behavior still require integration testing. Responsive CSS covers narrow phone layouts, tablets and desktop; this does not constitute visual browser verification.

### Files changed

- `src/main.jsx`: existing workflows, history, dashboard and account loading.
- `src/TransactionForm.jsx`: shared manual/review form.
- `src/transactions.js`: categories, amount/date validation, filtering and integer-cent totals.
- `src/data.js`: account-scoped reads/writes and private receipt operations.
- `src/phase2.css`: responsive form, filter and metric layout; focus/reduced-motion support retained.
- `src/supabase.js`: reject placeholder and non-publishable keys before creating the client.
- `tests/transactions.test.js`: domain verification.
- `README.md`: workflow and verification notes.

Income evidence upload remains unavailable. A future secure backend must handle payslips as sensitive documents, distinguish gross pay/deductions/net pay, and verify invoice payment before recording income. Next milestone: authenticated two-account integration tests for RLS and private storage, followed by a protected OCR service with review and reconciliation.


## Before committing

Read [the security policy](SECURITY.md) and [the pre-commit audit](docs/security-audit-2026-11-04.md). Only source, approved test fixtures and documentation belong in Git. Environment files, private receipts/exports, generated bundles, caches and browser artifacts are ignored. Vite validates its public environment before development or build starts. Never add a private provider key under VITE_.

## Warranty Tracker

Enable **Has warranty** in the optional **Warranty Information** section while uploading a receipt. Add one or several products, choose months or years, review the calculated expiry, and optionally enter an exact date from the official terms. The start date follows the purchase date until edited. Each product can have different terms.

For an existing receipt, open **Receipts → Warranty Information**, then add or manage products in **Warranties**. Search by product, brand or merchant and filter by status or receipt. Expiring soon includes today through 30 days; expired means before today. A missing purchase date is shown as unrecorded and requires an explicit warranty start date. Warranties are independent of the finance reporting month.

Warranty deletion requires confirmation and keeps the receipt and transaction. Receipt deletion warns that its linked warranties will also be deleted; the transaction remains. Receipt access still uses the private bucket and 60-second signed links. No AI extraction, reminders, notifications or claims are implemented.

The approved migration is `supabase/migrations/20261104171802_add_warranty_tracker.sql`. It was validated in isolated PostgreSQL before being applied to the existing project. See the [reviewed schema](docs/warranty-tracker-proposal.md) and [implementation results, file list and limitations](docs/warranty-tracker-results.md).

Verification commands:

```sh
npm.cmd test
npm.cmd run build
```

The optional SQL verifier uses a pinned, isolated test engine, with no application dependency changes and no Supabase connection:

```sh
npm.cmd install --prefix .ui-verification/warranty-db --save-exact @electric-sql/pglite@0.5.15
npm.cmd run test:db
```

For browser verification, start `npm.cmd run dev -- --port 5178` in another terminal, then run `npm.cmd run test:ui` and `npm.cmd run test:warranty-ui`. These scripts use an installed Microsoft Edge (or `FINFLOW_TEST_BROWSER`), isolated synthetic data, and blocked external HTTPS requests. They never exercise a real user's records. Screenshots and reports are written to the ignored `.ui-verification` directory in the parent workspace. A signed-in end-to-end test of the live project remains a separate verification step; isolated tests are not represented as live-user testing.
