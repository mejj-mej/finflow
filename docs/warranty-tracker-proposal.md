# Warranty Tracker: schema and implementation proposal

Status: **approved by the user and applied as remote migration `20261104171802_add_warranty_tracker`. See [implementation results](warranty-tracker-results.md) for final validation and limitations.**

## Inspection and scope

Inspected the linked Supabase project `syvvocztwlvdiyzgwtxq` on 2026-11-05 using read-only schema queries. It runs PostgreSQL 17.11. Existing public tables are `transactions`, `receipts`, and `monthly_budgets`, all with RLS enabled. There is no `warranties` table.

`receipts.id` is a UUID primary key, `receipts.user_id` references `auth.users`, and `receipt_date` is a nullable SQL date. Existing receipt policies scope authenticated CRUD to `auth.uid() = user_id`, with both USING and WITH CHECK on updates. Receipt storage policies scope access to the signed-in user's folder in `finflow-receipts`. The app currently requests 60-second signed URLs.

This proposal adds one table and one timestamp trigger function. It does not alter existing tables, policies, storage settings, receipt metadata, transactions, financial calculations, or authentication. No existing records need migration or backfill.

## Data model and ownership

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | UUID, generated primary key | Independent product warranty |
| `user_id` | UUID, required, defaults to `auth.uid()` | Owner; FK to `auth.users` |
| `receipt_id` | UUID, required | FK to existing receipt |
| `product_name` | Text, required, 1–300 trimmed characters | Product identifier |
| `brand_model` | Nullable text, up to 200 characters | Optional product detail |
| `warranty_start_date` | Date, required | Explicit start; UI initially uses purchase date |
| `warranty_duration` | Positive integer | Up to 1,200 months or 100 years |
| `warranty_duration_unit` | Text, months or years | Calendar arithmetic |
| `expiration_date_override` | Nullable date | Exact date from official terms |
| `expiration_date` | Stored generated date | Override, otherwise start plus duration |
| `notes` | Nullable text, up to 5,000 characters | Optional warranty detail |
| `created_at`, `updated_at` | Timestamp with time zone | Database-maintained audit times |

There is deliberately no uniqueness constraint on `receipt_id`: several products can share a receipt. Purchase date is read from the linked receipt, not duplicated. If it is missing, the UI displays "Not recorded" and asks for a warranty start date rather than inventing one.

A foreign key guarantees the receipt exists. RLS separately checks that **both the warranty and the referenced receipt belong to the authenticated user**. This avoids adding a composite unique constraint to the existing receipts table. UPDATE checks both the previous row and the proposed row. Repointing a warranty to another user's receipt, spoofing `user_id`, and anonymous CRUD are denied. SELECT also checks receipt ownership, protecting visibility if an administrator later changes a receipt's owner. Privileged administrators can bypass RLS; no browser receives privileged credentials.

Deleting a receipt will cascade to its warranty rows; the UI must explicitly warn about this before receipt deletion. Deleting a warranty leaves the receipt and transaction intact. Deleting an account cascades its warranties. These are new relationships, not modifications to existing receipt deletion code until the UI integration is approved.

## Date behavior

Store start, override, and expiration as SQL `date`, never timestamps. Compute expiry in the database so callers cannot submit an inconsistent calculated date. The frontend implements matching calendar arithmetic for preview: add the full number of calendar months once and clamp the day to the destination month's last day. A year is 12 calendar months, not 365 days.

Read-only checks against this PostgreSQL instance returned:

- `2024-01-31 + 1 month` → `2024-02-29`.
- `2023-01-31 + 1 month` → `2023-02-28`.
- `2024-02-29 + 1 year` → `2025-02-28`.

The generated expression uses immutable PostgreSQL date/interval operations, verified in `pg_proc`. An exact override replaces the calculated date; clearing it restores automatic calculation. Dates must be within years 0001–9999 and expiration must not precede the start. Duration remains required even with an override, preserving the entered terms.

Status is never stored. Compare date-only calendar days against the user's local current date: greater than 30 days is Active; 0–30 inclusive is Expiring soon; below zero is Expired. Refresh when the local day changes and when the page becomes visible. Do not parse dates as local midnight and divide elapsed milliseconds across daylight-saving changes.

## Reviewed forward migration

The SQL below is the complete approved migration body, validated in isolated PostgreSQL before application. The local file was created using `supabase migration new add_warranty_tracker` with CLI 3.0.0, then aligned to the actual remote migration version. Its SQL matches this reviewed body exactly.

```sql
begin;

create table public.warranties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  receipt_id uuid not null
    references public.receipts(id) on delete cascade,
  product_name text not null,
  brand_model text,
  warranty_start_date date not null,
  warranty_duration integer not null,
  warranty_duration_unit text not null,
  expiration_date_override date,
  expiration_date date generated always as (
    coalesce(
      expiration_date_override,
      (warranty_start_date + make_interval(months =>
        case warranty_duration_unit
          when 'years' then warranty_duration * 12
          else warranty_duration
        end
      ))::date
    )
  ) stored,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warranties_product_name_check
    check (char_length(btrim(product_name)) between 1 and 300),
  constraint warranties_brand_model_check
    check (brand_model is null or char_length(brand_model) <= 200),
  constraint warranties_duration_check check (
    (warranty_duration_unit = 'months' and warranty_duration between 1 and 1200)
    or (warranty_duration_unit = 'years' and warranty_duration between 1 and 100)
  ),
  constraint warranties_start_date_check
    check (warranty_start_date between date '0001-01-01' and date '9999-12-31'),
  constraint warranties_expiration_check check (
    expiration_date is not null
    and expiration_date >= warranty_start_date
    and expiration_date <= date '9999-12-31'
  ),
  constraint warranties_notes_check
    check (notes is null or char_length(notes) <= 5000)
);

create index warranties_owner_expiration_idx
  on public.warranties (user_id, expiration_date, id);
create index warranties_receipt_idx on public.warranties (receipt_id);

create function public.finflow_warranty_timestamps()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    NEW.created_at := now();
  else
    NEW.created_at := OLD.created_at;
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$;

revoke all on function public.finflow_warranty_timestamps()
  from public, anon, authenticated;

create trigger warranties_timestamps
before insert or update on public.warranties
for each row execute function public.finflow_warranty_timestamps();

alter table public.warranties enable row level security;

create policy warranties_read on public.warranties
for select to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.receipts r
    where r.id = warranties.receipt_id
      and r.user_id = (select auth.uid())
  )
);

create policy warranties_add on public.warranties
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.receipts r
    where r.id = warranties.receipt_id
      and r.user_id = (select auth.uid())
  )
);

create policy warranties_edit on public.warranties
for update to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.receipts r
    where r.id = warranties.receipt_id
      and r.user_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.receipts r
    where r.id = warranties.receipt_id
      and r.user_id = (select auth.uid())
  )
);

create policy warranties_remove on public.warranties
for delete to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.receipts r
    where r.id = warranties.receipt_id
      and r.user_id = (select auth.uid())
  )
);

-- Remove inherited/default client grants, including TRUNCATE and REFERENCES.
revoke all on table public.warranties from public, anon, authenticated;
grant select, delete on table public.warranties to authenticated;
grant insert (
  user_id, receipt_id, product_name, brand_model, warranty_start_date,
  warranty_duration, warranty_duration_unit, expiration_date_override, notes
) on public.warranties to authenticated;
grant update (
  receipt_id, product_name, brand_model, warranty_start_date,
  warranty_duration, warranty_duration_unit, expiration_date_override, notes
) on public.warranties to authenticated;

commit;
```

Clients cannot update the owner, ID, timestamps, or generated expiry. The trigger is SECURITY INVOKER with an empty search path, touches only its own NEW row, and has no client EXECUTE grant. There are no new RPC endpoints, definer functions, public storage links, or anonymous grants.

## Rollout and recovery

1. Obtain approval for this schema, policies, cascade behavior, and implementation scope.
2. Generate the migration locally. Add a narrow `.gitignore` exception for `supabase/migrations/*.sql`; leave other SQL dumps ignored. Store no personal data or credentials in migration files.
3. Recheck the live schema for drift and test the migration against a disposable/local PostgreSQL environment if one is available. Verify generated-column syntax, grants, trigger behavior, and two-user/anonymous RLS with synthetic records in an isolated database. Do not create test users or financial records in the live project.
4. Apply the approved migration to the linked project using the migration tool. Do not change other Supabase settings. If validation fails, stop and report rather than weakening RLS.
5. Verify live schema, policies, grants, and security advisors with read-only queries. Any inability to perform isolated role-level tests must be reported as a limitation.
6. Implement the UI and tests described below, using existing dependencies and Iris tokens. Run the existing suite, new tests, browser checks, and production build. Do not deploy, commit, or push.

The forward migration is transactional: a failure before commit rolls it back. After successful rollout, application code can be reverted while retaining the warranty table and data. Do not automatically drop the table to undo a UI release. A schema rollback would require separate approval, export/backup of any warranties, then removal of only the new table and trigger function; existing receipts and transactions must remain intact.

## Frontend implementation after approval

- Add a shield-icon Warranties navigation entry immediately after Receipts, with responsive navigation that fits at 320px and maintains readable labels and touch targets.
- Reuse existing Iris tokens, glossy buttons, frosted panels, focus styles, and reduced-motion behavior; keep new styles scoped to warranty components.
- Add an optional **Warranty Information** section to receipt upload, initially unchecked. Support multiple product drafts, duration/unit, editable start, automatic preview, exact-date override, and notes. New draft starts follow the purchase date until manually edited. Turning off warranty information must not silently delete saved records.
- Add receipt-level warranty management for existing receipts. The app currently has no receipt metadata editing form; add warranty editing without rewriting receipt or transaction fields. Deleting an existing warranty requires explicit confirmation.
- Add a Warranties page with status counts, All/Active/Expiring soon/Expired filters, product/brand/receipt search, responsive results, purchase/start/expiry dates, days remaining, and working edit/delete/receipt actions. No AI/reminder/claim buttons.
- A receipt selection is required for warranties created from the Warranties page. No records means "Has warranty" is false; no flag is added to receipts. Missing receipt dates are clearly labeled.
- Save upload warranties only after the existing expense and private receipt succeed. Batch new products in a single insert. If warranty saving fails after those succeed, retain the saved receipt ID and drafts and retry only warranty saving; do not create another expense or upload. Keep existing partial-attachment recovery behavior.
- Fetch warranty rows independently so an error cannot hide existing finance data. Use server ownership policies plus explicit user filters. Clear account-scoped state on logout/switch; guard asynchronous loads, mutations, messages, and signed-link responses with an account/session generation so an old response cannot affect the next session, including switching away and back to the same user.
- Reuse private storage and on-demand 60-second signed URLs. Do not persist URLs in warranty records, browser storage, or logs.
- Provide labeled inputs, inline validation, announced save/error states, keyboard operation, loading/empty/retry states, and disabled duplicate submissions.

Expected files: new `src/warranties.js`, `src/WarrantyForm.jsx`, `src/Warranties.jsx`, scoped warranty CSS, new domain/data/UI tests; updates to `src/main.jsx`, `src/data.js`, `src/TransactionForm.jsx`, `src/Icon.jsx`, existing UI verification fixtures/scripts, `.gitignore`, and the generated migration. Exact filenames may be adjusted to fit existing conventions without expanding scope.

## Validation plan and current results

Baseline checks before implementation:

- `node --test`: **13 passed**, 0 failures.
- `npm.cmd run build`: **passed**. `npm` alone resolves to a blocked PowerShell script on this machine; using the installed `npm.cmd` avoids changing execution policy.
- Live metadata and date-arithmetic queries: **passed, read-only**, with no user records fetched.
- Full migration execution and new feature tests: **not run; approval pending**.

After approval, add tests for month/year clamping, leap centuries, timezone-independent day differences, 31/30/0/-1 status boundaries, manual overrides/reset, input limits and invalid calendar dates, multiple products, CRUD/error recovery without duplicate expenses, receipt association and signing, and stale asynchronous responses across auth changes. Check new forms/page at desktop and 320–430px mobile widths, keyboard focus, overflow, and reduced motion. Test own-account access, cross-account reads/writes/relinking, owner reassignment, anonymous denial, generated expiry protection, and cascade deletion against synthetic isolated database fixtures where possible. Frontend mocks alone must not be presented as proof that live RLS works.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [PostgreSQL date arithmetic](https://www.postgresql.org/docs/17/functions-datetime.html), [PostgreSQL constraints](https://www.postgresql.org/docs/17/ddl-constraints.html). The Supabase changelog Markdown endpoint could not be rendered by the web tool; relevant current documentation was checked through Supabase's documentation tool instead.
