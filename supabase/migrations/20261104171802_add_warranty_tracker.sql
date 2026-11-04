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
