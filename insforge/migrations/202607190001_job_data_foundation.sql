create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  location text,
  current_title text,
  experience_level text check (
    experience_level is null
    or experience_level in ('junior', 'mid', 'senior', 'lead')
  ),
  years_experience integer check (
    years_experience is null or years_experience >= 0
  ),
  skills text[] not null default '{}'::text[],
  industries text[] not null default '{}'::text[],
  work_experience jsonb not null default '[]'::jsonb check (
    jsonb_typeof(work_experience) = 'array'
  ),
  education jsonb check (
    education is null or jsonb_typeof(education) = 'object'
  ),
  job_titles_seeking text[] not null default '{}'::text[],
  remote_preference text check (
    remote_preference is null
    or remote_preference in ('remote', 'onsite', 'hybrid', 'any')
  ),
  preferred_locations text[] not null default '{}'::text[],
  salary_expectation text,
  cover_letter_tone text check (
    cover_letter_tone is null
    or cover_letter_tone in ('formal', 'casual', 'enthusiastic')
  ),
  linkedin_url text,
  portfolio_url text,
  work_authorization text check (
    work_authorization is null
    or work_authorization in ('citizen', 'permanent_resident', 'visa_required')
  ),
  resume_pdf_url text,
  is_complete boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint profiles_resume_pdf_url_check check (
    resume_pdf_url is null
    or resume_pdf_url = id::text || '/resume.pdf'
  )
);

create function public.jobpilot_set_profile_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.jobpilot_set_profile_updated_at();

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'running' check (
    status in ('running', 'completed', 'failed')
  ),
  job_title_searched text not null,
  location_searched text,
  jobs_found integer not null default 0 check (jobs_found >= 0),
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  constraint agent_runs_id_user_id_key unique (id, user_id),
  constraint agent_runs_status_completed_at_check check (
    (status = 'running' and completed_at is null)
    or (status in ('completed', 'failed') and completed_at is not null)
  )
);

create function public.jobpilot_enforce_agent_run_state()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'running' or new.completed_at is not null then
      raise exception 'agent runs must start as running without a completion time';
    end if;
    return new;
  end if;

  if old.status in ('completed', 'failed') then
    if new.status is distinct from old.status
      or new.completed_at is distinct from old.completed_at then
      raise exception 'terminal agent run state and completion time are immutable';
    end if;
    return new;
  end if;

  if new.status = 'running' then
    if new.completed_at is not null then
      raise exception 'running agent runs cannot have a completion time';
    end if;
  elsif new.status in ('completed', 'failed') then
    new.completed_at := clock_timestamp();
  else
    raise exception 'invalid agent run status transition';
  end if;

  return new;
end;
$$;

create trigger agent_runs_enforce_state
before insert or update on public.agent_runs
for each row execute function public.jobpilot_enforce_agent_run_state();

create index agent_runs_user_started_at_idx
on public.agent_runs (user_id, started_at desc);

create index agent_runs_user_status_idx
on public.agent_runs (user_id, status);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid,
  user_id uuid not null references public.profiles (id) on delete cascade,
  external_id text,
  source text not null check (source in ('search', 'url')),
  source_url text not null,
  external_apply_url text not null,
  title text not null,
  company text not null,
  location text,
  salary text,
  job_type text check (
    job_type is null or job_type in ('fulltime', 'parttime', 'contract')
  ),
  about_role text not null,
  responsibilities text[] not null default '{}'::text[],
  requirements text[] not null default '{}'::text[],
  nice_to_have text[] not null default '{}'::text[],
  benefits text[] not null default '{}'::text[],
  about_company text,
  match_score integer check (
    match_score is null or match_score between 0 and 100
  ),
  match_reason text,
  matched_skills text[] not null default '{}'::text[],
  missing_skills text[] not null default '{}'::text[],
  company_research jsonb check (
    company_research is null or jsonb_typeof(company_research) = 'object'
  ),
  found_at timestamptz not null default clock_timestamp(),
  constraint jobs_id_user_id_key unique (id, user_id),
  constraint jobs_id_run_id_user_id_key unique (id, run_id, user_id),
  constraint jobs_run_owner_fkey foreign key (run_id, user_id)
    references public.agent_runs (id, user_id) on delete cascade
);

create index jobs_user_found_at_idx
on public.jobs (user_id, found_at desc);

create index jobs_user_match_score_idx
on public.jobs (user_id, match_score desc);

create index jobs_run_id_idx
on public.jobs (run_id);

create unique index jobs_user_source_external_id_key
on public.jobs (user_id, source, external_id)
where external_id is not null;

create table public.agent_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text not null,
  level text not null check (
    level in ('info', 'success', 'warning', 'error')
  ),
  job_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  constraint agent_logs_run_owner_fkey foreign key (run_id, user_id)
    references public.agent_runs (id, user_id) on delete cascade,
  constraint agent_logs_job_run_owner_fkey foreign key (job_id, run_id, user_id)
    references public.jobs (id, run_id, user_id) on delete cascade
);

create index agent_logs_run_created_at_idx
on public.agent_logs (run_id, created_at);

create index agent_logs_user_created_at_idx
on public.agent_logs (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_runs force row level security;
alter table public.jobs enable row level security;
alter table public.jobs force row level security;
alter table public.agent_logs enable row level security;
alter table public.agent_logs force row level security;

create policy profiles_select_own on public.profiles
for select using (auth.uid() = id);
create policy profiles_insert_own on public.profiles
for insert with check (auth.uid() = id);
create policy profiles_update_own on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_delete_own on public.profiles
for delete using (auth.uid() = id);

create policy agent_runs_select_own on public.agent_runs
for select using (auth.uid() = user_id);
create policy agent_runs_insert_own on public.agent_runs
for insert with check (auth.uid() = user_id);
create policy agent_runs_update_own on public.agent_runs
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy agent_runs_delete_own on public.agent_runs
for delete using (auth.uid() = user_id);

create policy jobs_select_own on public.jobs
for select using (auth.uid() = user_id);
create policy jobs_insert_own on public.jobs
for insert with check (auth.uid() = user_id);
create policy jobs_update_own on public.jobs
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy jobs_delete_own on public.jobs
for delete using (auth.uid() = user_id);

create policy agent_logs_select_own on public.agent_logs
for select using (auth.uid() = user_id);
create policy agent_logs_insert_own on public.agent_logs
for insert with check (auth.uid() = user_id);
create policy agent_logs_update_own on public.agent_logs
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy agent_logs_delete_own on public.agent_logs
for delete using (auth.uid() = user_id);
