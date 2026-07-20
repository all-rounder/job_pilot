alter table public.profiles
add column first_completed_at timestamptz;

alter table public.profiles
drop constraint profiles_resume_pdf_url_check;

alter table public.profiles
add constraint profiles_resume_pdf_url_check check (
  resume_pdf_url is null
  or (
    resume_pdf_url like id::text || '/resume-%.pdf'
    and resume_pdf_url not like '%/%/%'
  )
);

create function public.jobpilot_save_profile(p_profile jsonb)
returns table (profile jsonb, first_completed boolean)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_previous_completed_at timestamptz;
  v_is_complete boolean := coalesce((p_profile ->> 'is_complete')::boolean, false);
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select first_completed_at
  into v_previous_completed_at
  from public.profiles
  where id = v_user_id;

  insert into public.profiles (
    id,
    email,
    full_name,
    phone,
    location,
    current_title,
    experience_level,
    years_experience,
    skills,
    industries,
    work_experience,
    education,
    job_titles_seeking,
    remote_preference,
    preferred_locations,
    salary_expectation,
    cover_letter_tone,
    linkedin_url,
    portfolio_url,
    work_authorization,
    is_complete,
    first_completed_at
  ) values (
    v_user_id,
    p_profile ->> 'email',
    nullif(p_profile ->> 'full_name', ''),
    nullif(p_profile ->> 'phone', ''),
    nullif(p_profile ->> 'location', ''),
    nullif(p_profile ->> 'current_title', ''),
    nullif(p_profile ->> 'experience_level', ''),
    (p_profile ->> 'years_experience')::integer,
    array(select jsonb_array_elements_text(p_profile -> 'skills')),
    array(select jsonb_array_elements_text(p_profile -> 'industries')),
    p_profile -> 'work_experience',
    p_profile -> 'education',
    array(select jsonb_array_elements_text(p_profile -> 'job_titles_seeking')),
    nullif(p_profile ->> 'remote_preference', ''),
    array(select jsonb_array_elements_text(p_profile -> 'preferred_locations')),
    nullif(p_profile ->> 'salary_expectation', ''),
    nullif(p_profile ->> 'cover_letter_tone', ''),
    nullif(p_profile ->> 'linkedin_url', ''),
    nullif(p_profile ->> 'portfolio_url', ''),
    nullif(p_profile ->> 'work_authorization', ''),
    v_is_complete,
    case when v_is_complete then clock_timestamp() else null end
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone,
    location = excluded.location,
    current_title = excluded.current_title,
    experience_level = excluded.experience_level,
    years_experience = excluded.years_experience,
    skills = excluded.skills,
    industries = excluded.industries,
    work_experience = excluded.work_experience,
    education = excluded.education,
    job_titles_seeking = excluded.job_titles_seeking,
    remote_preference = excluded.remote_preference,
    preferred_locations = excluded.preferred_locations,
    salary_expectation = excluded.salary_expectation,
    cover_letter_tone = excluded.cover_letter_tone,
    linkedin_url = excluded.linkedin_url,
    portfolio_url = excluded.portfolio_url,
    work_authorization = excluded.work_authorization,
    is_complete = excluded.is_complete,
    first_completed_at = case
      when profiles.first_completed_at is null and excluded.is_complete
      then clock_timestamp()
      else profiles.first_completed_at
    end
  returning * into v_profile;

  return query select
    to_jsonb(v_profile),
    v_previous_completed_at is null and v_profile.first_completed_at is not null;
end;
$$;

create function public.jobpilot_keep_first_completion_immutable()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.first_completed_at is not null
    and new.first_completed_at is distinct from old.first_completed_at then
    raise exception 'first completion time is immutable';
  end if;

  return new;
end;
$$;

create trigger profiles_keep_first_completion_immutable
before update on public.profiles
for each row execute function public.jobpilot_keep_first_completion_immutable();
