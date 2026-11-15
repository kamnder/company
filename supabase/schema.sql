-- COMPANY v1.1.0 — multi-tenant database foundation
-- Applied to Supabase project: rgvfnsweikoysvemntzp
-- This file documents the initial migration. Review before applying to another project.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner'
    check (role in ('owner','admin','manager','employee','accountant','viewer')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text,
  status text not null default 'todo'
    check (status in ('todo','in_progress','done','cancelled')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  due_date date,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_members_user_id_idx
  on public.company_members(user_id);
create index if not exists tasks_company_created_idx
  on public.tasks(company_id, created_at desc);
create index if not exists tasks_assigned_to_idx
  on public.tasks(assigned_to);

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "companies_select_members" on public.companies;
create policy "companies_select_members" on public.companies
for select to authenticated
using (exists (
  select 1 from public.company_members m
  where m.company_id = companies.id and m.user_id = (select auth.uid())
));

drop policy if exists "companies_insert_creator" on public.companies;
create policy "companies_insert_creator" on public.companies
for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists "companies_update_admins" on public.companies;
create policy "companies_update_admins" on public.companies
for update to authenticated
using (exists (
  select 1 from public.company_members m
  where m.company_id = companies.id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin')
))
with check (exists (
  select 1 from public.company_members m
  where m.company_id = companies.id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin')
));

drop policy if exists "members_select_same_company" on public.company_members;
create policy "members_select_same_company" on public.company_members
for select to authenticated
using (exists (
  select 1 from public.company_members mine
  where mine.company_id = company_members.company_id
    and mine.user_id = (select auth.uid())
));

drop policy if exists "members_insert_initial_owner" on public.company_members;
create policy "members_insert_initial_owner" on public.company_members
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'owner'
  and exists (
    select 1 from public.companies c
    where c.id = company_members.company_id
      and c.created_by = (select auth.uid())
  )
);

drop policy if exists "tasks_select_company_members" on public.tasks;
create policy "tasks_select_company_members" on public.tasks
for select to authenticated
using (exists (
  select 1 from public.company_members m
  where m.company_id = tasks.company_id and m.user_id = (select auth.uid())
));

drop policy if exists "tasks_insert_company_members" on public.tasks;
create policy "tasks_insert_company_members" on public.tasks
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.company_members m
    where m.company_id = tasks.company_id and m.user_id = (select auth.uid())
  )
);

drop policy if exists "tasks_update_company_members" on public.tasks;
create policy "tasks_update_company_members" on public.tasks
for update to authenticated
using (exists (
  select 1 from public.company_members m
  where m.company_id = tasks.company_id and m.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.company_members m
  where m.company_id = tasks.company_id and m.user_id = (select auth.uid())
));

drop policy if exists "tasks_delete_company_admins" on public.tasks;
create policy "tasks_delete_company_admins" on public.tasks
for delete to authenticated
using (exists (
  select 1 from public.company_members m
  where m.company_id = tasks.company_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin','manager')
));

grant select, insert, update on public.companies to authenticated;
grant select, insert on public.company_members to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;

-- Do not expose service_role or secret keys in browser/mobile clients.
-- Membership invitations and role changes require a trusted server-side flow.
