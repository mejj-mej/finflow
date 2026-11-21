-- Retrieved 2026-11-21 (read-only) from supabase_migrations.schema_migrations, version 20261028053938.
-- Already applied to the live project. Body below is byte-identical to the stored statement
-- (md5 a547535a3eabccac2d7575f14316ad27). Do not edit; add new migrations instead.
create extension if not exists pgcrypto;
create table public.transactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 transaction_date date not null default current_date,
 description text not null check (char_length(trim(description)) between 1 and 300),
 merchant text, kind text not null check(kind in ('income','expense')),
 category text not null default 'Uncategorized',
 amount numeric(12,2) not null check(amount > 0),
 currency text not null default 'PHP' check(currency='PHP'),
 payment_method text, notes text,
 source text not null default 'manual' check(source in ('manual','receipt','import')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,user_id)
);
create index transactions_user_date_idx on public.transactions(user_id,transaction_date desc);
alter table public.transactions enable row level security;
create policy tx_read on public.transactions for select to authenticated using ((select auth.uid())=user_id);
create policy tx_add on public.transactions for insert to authenticated with check ((select auth.uid())=user_id);
create policy tx_edit on public.transactions for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy tx_remove on public.transactions for delete to authenticated using ((select auth.uid())=user_id);
create table public.receipts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 transaction_id uuid,
 storage_path text not null,
 merchant text, receipt_date date,
 total numeric(12,2) check(total > 0),
 currency text not null default 'PHP' check(currency='PHP'),
 suggested_category text,
 extraction_status text not null default 'pending' check(extraction_status in ('pending','review','verified','failed')),
 extraction_confidence numeric(4,3) check(extraction_confidence between 0 and 1),
 extracted_data jsonb,
 created_at timestamptz not null default now(),
 unique(user_id,storage_path),
 constraint receipt_path_own check(split_part(storage_path,'/',1)=user_id::text),
 constraint receipt_tx_own foreign key(transaction_id,user_id) references public.transactions(id,user_id) on delete set null (transaction_id)
);
create index receipts_user_created_idx on public.receipts(user_id,created_at desc);
alter table public.receipts enable row level security;
create policy rec_read on public.receipts for select to authenticated using ((select auth.uid())=user_id);
create policy rec_add on public.receipts for insert to authenticated with check ((select auth.uid())=user_id);
create policy rec_edit on public.receipts for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy rec_remove on public.receipts for delete to authenticated using ((select auth.uid())=user_id);
create table public.monthly_budgets(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 month date not null check(extract(day from month)=1),
 category text not null,
 amount numeric(12,2) not null check(amount >= 0),
 unique(user_id,month,category)
);
alter table public.monthly_budgets enable row level security;
create policy budget_read on public.monthly_budgets for select to authenticated using ((select auth.uid())=user_id);
create policy budget_add on public.monthly_budgets for insert to authenticated with check ((select auth.uid())=user_id);
create policy budget_edit on public.monthly_budgets for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy budget_remove on public.monthly_budgets for delete to authenticated using ((select auth.uid())=user_id);
revoke all on public.transactions,public.receipts,public.monthly_budgets from anon;
grant select,insert,update,delete on public.transactions,public.receipts,public.monthly_budgets to authenticated;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('finflow-receipts','finflow-receipts',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do nothing;
create policy finflow_receipts_read on storage.objects for select to authenticated using (bucket_id='finflow-receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy finflow_receipts_upload on storage.objects for insert to authenticated with check(bucket_id='finflow-receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy finflow_receipts_delete on storage.objects for delete to authenticated using(bucket_id='finflow-receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
