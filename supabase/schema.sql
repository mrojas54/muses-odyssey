-- ── Quiz History Sync schema ───────────────────────────────────────────────
-- Run once in the Supabase SQL editor. Single shared reader; no per-user rows.
-- Project: https://agtfetvhsflmhhmddzxm.supabase.co

-- ── Auto-RLS: force RLS ON for every table ever created in `public` ─────────
-- SQL-created tables ship with RLS OFF (only the dashboard Table Editor auto-
-- enables it). As this grows into a book-club reading-comprehension app, new
-- tables (discussion threads, member notes, per-chapter responses…) must never
-- land RLS-off and silently leak reader data through the Data API. This DDL
-- event trigger flips RLS on at CREATE TABLE time. RLS-on with no policy =
-- deny-all, so every new table fails CLOSED until you write a policy for it.
create or replace function public.force_rls_on_new_tables()
  returns event_trigger language plpgsql as $$
declare obj record;
begin
  for obj in
    select * from pg_event_trigger_ddl_commands()
    where command_tag = 'CREATE TABLE' and schema_name = 'public'
  loop
    execute format('alter table %s enable row level security', obj.object_identity);
  end loop;
end;
$$;
drop event trigger if exists on_create_table_force_rls;
create event trigger on_create_table_force_rls
  on ddl_command_end when tag in ('CREATE TABLE')
  execute function public.force_rls_on_new_tables();

-- current synced state, one row per book (or 'exam')
create table if not exists public.book_progress (
  book_id    text primary key,
  best_score int,
  total      int,
  read       boolean default false,
  misses     jsonb   default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- append-only: one row per completed sitting
create table if not exists public.attempts_summary (
  id        bigint generated always as identity primary key,
  book_id   text not null,
  score     int  not null,
  total     int  not null,
  breakdown jsonb,          -- by-kind: {"event":{"c":n,"t":n}, ...}
  by_book   jsonb,          -- per-book breakdown; exam sittings only
  taken_at  timestamptz default now()
);

-- append-only: one row per omen answered
create table if not exists public.attempts_raw (
  id         bigint generated always as identity primary key,
  attempt_id bigint not null references public.attempts_summary(id) on delete cascade,
  book_id    text not null,   -- the omen's SOURCE book (= srcId)
  qi         int  not null,
  kind       text,
  chosen     int,
  is_correct boolean
);
create index if not exists attempts_raw_attempt_idx on public.attempts_raw(attempt_id);

-- ── scoped role: the JWT's `role` claim switches PostgREST to this DB role ──
do $$ begin
  if not exists (select from pg_roles where rolname = 'muse_reader') then
    create role muse_reader nologin;
  end if;
end $$;
grant muse_reader to authenticator;
grant usage on schema public to muse_reader;
grant select, insert, update on public.book_progress    to muse_reader;
grant select, insert          on public.attempts_summary to muse_reader;
grant select, insert          on public.attempts_raw     to muse_reader;
grant usage, select on all sequences in schema public to muse_reader;

-- ── RLS: only a caller presenting the muse_reader token may touch the tables ─
-- The event trigger above already flipped these ON at CREATE TABLE time on a
-- fresh run. These explicit ALTERs are idempotent belt-and-suspenders: they
-- also cover a RE-run, where `create table if not exists` skips creation so the
-- trigger never fires for the pre-existing three.
alter table public.book_progress   enable row level security;
alter table public.attempts_summary enable row level security;
alter table public.attempts_raw     enable row level security;

create policy muse_rw on public.book_progress    for all to muse_reader using (true) with check (true);
create policy muse_rw on public.attempts_summary for all to muse_reader using (true) with check (true);
create policy muse_rw on public.attempts_raw     for all to muse_reader using (true) with check (true);
