-- AMEX Expense App V3.0.1
-- Run once in Supabase SQL Editor.
-- Confirm the allowed email before running.

alter table public.expenses
  add column if not exists client_updated_at timestamptz not null default now();

alter table public.user_settings
  add column if not exists client_updated_at timestamptz not null default now();

-- One-time cleanup: for active rows with the same date, amount, category and note,
-- keep the oldest row and convert the others to soft-deleted tombstones.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, expense_date, amount, category, note
      order by created_at asc, id asc
    ) as duplicate_rank
  from public.expenses
  where deleted = false
)
update public.expenses e
set
  deleted = true,
  client_updated_at = now(),
  updated_at = now()
from ranked r
where e.id = r.id
  and r.duplicate_rank > 1;

-- Final database guard. Active exact duplicates are not allowed.
create unique index if not exists expenses_owner_content_unique
on public.expenses (user_id, expense_date, amount, category, note)
where deleted = false;

alter table public.expenses enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "Users can read own expenses" on public.expenses;
drop policy if exists "Users can insert own expenses" on public.expenses;
drop policy if exists "Users can update own expenses" on public.expenses;
drop policy if exists "Users can delete own expenses" on public.expenses;
drop policy if exists "Only owner can read expenses" on public.expenses;
drop policy if exists "Only owner can insert expenses" on public.expenses;
drop policy if exists "Only owner can update expenses" on public.expenses;

drop policy if exists "Users can read own settings" on public.user_settings;
drop policy if exists "Users can insert own settings" on public.user_settings;
drop policy if exists "Users can update own settings" on public.user_settings;
drop policy if exists "Only owner can read settings" on public.user_settings;
drop policy if exists "Only owner can insert settings" on public.user_settings;
drop policy if exists "Only owner can update settings" on public.user_settings;

create policy "Only owner can read expenses"
on public.expenses for select
using (
  auth.uid() = user_id
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'gnaguy.lee@gmail.com'
);

create policy "Only owner can insert expenses"
on public.expenses for insert
with check (
  auth.uid() = user_id
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'gnaguy.lee@gmail.com'
);

create policy "Only owner can update expenses"
on public.expenses for update
using (
  auth.uid() = user_id
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'gnaguy.lee@gmail.com'
)
with check (
  auth.uid() = user_id
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'gnaguy.lee@gmail.com'
);

-- No hard-delete policy. deleted=true is required for safe offline synchronization.

create policy "Only owner can read settings"
on public.user_settings for select
using (
  auth.uid() = user_id
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'gnaguy.lee@gmail.com'
);

create policy "Only owner can insert settings"
on public.user_settings for insert
with check (
  auth.uid() = user_id
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'gnaguy.lee@gmail.com'
);

create policy "Only owner can update settings"
on public.user_settings for update
using (
  auth.uid() = user_id
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'gnaguy.lee@gmail.com'
)
with check (
  auth.uid() = user_id
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'gnaguy.lee@gmail.com'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();
