-- COMPANY: initial tenant isolation schema (Supabase/Postgres)
create extension if not exists pgcrypto;
create table if not exists public.companies(id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 2 and 120),created_at timestamptz not null default now());
create table if not exists public.company_members(company_id uuid references public.companies(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,role text not null default 'member' check(role in ('owner','admin','manager','member','viewer')),created_at timestamptz not null default now(),primary key(company_id,user_id));
create table if not exists public.tasks(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,title text not null check(length(trim(title)) between 1 and 240),status text not null default 'new' check(status in ('new','in_progress','done','cancelled')),created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default now());
create index if not exists tasks_company_created_idx on public.tasks(company_id,created_at desc);
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.tasks enable row level security;
create policy "members read companies" on public.companies for select to authenticated using(exists(select 1 from public.company_members m where m.company_id=id and m.user_id=auth.uid()));
create policy "users read own memberships" on public.company_members for select to authenticated using(user_id=auth.uid());
create policy "members read tasks" on public.tasks for select to authenticated using(exists(select 1 from public.company_members m where m.company_id=tasks.company_id and m.user_id=auth.uid()));
create policy "members create tasks" on public.tasks for insert to authenticated with check(created_by=auth.uid() and exists(select 1 from public.company_members m where m.company_id=tasks.company_id and m.user_id=auth.uid() and m.role in ('owner','admin','manager','member')));
create policy "members update tasks" on public.tasks for update to authenticated using(exists(select 1 from public.company_members m where m.company_id=tasks.company_id and m.user_id=auth.uid() and m.role in ('owner','admin','manager','member'))) with check(exists(select 1 from public.company_members m where m.company_id=tasks.company_id and m.user_id=auth.uid() and m.role in ('owner','admin','manager','member')));
create policy "admins delete tasks" on public.tasks for delete to authenticated using(exists(select 1 from public.company_members m where m.company_id=tasks.company_id and m.user_id=auth.uid() and m.role in ('owner','admin')));
-- Company/member creation and role changes must be handled by trusted server-side onboarding.
-- Never expose Supabase service_role keys in browser code.
