-- Least privilege for browser clients on the base finance tables.
-- Supabase default privileges on schema public gave `authenticated` TRUNCATE, TRIGGER and
-- REFERENCES in addition to the CRUD granted by 20261028053938. The app needs only
-- SELECT/INSERT/UPDATE/DELETE, which stay in place and remain row-filtered by RLS.
-- TRUNCATE in particular is not subject to row-level security.
-- Matches the warranties table, which already grants clients only what they need.
revoke truncate, trigger, references
  on table public.transactions, public.receipts, public.monthly_budgets
  from authenticated;
