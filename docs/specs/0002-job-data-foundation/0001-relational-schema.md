# Relational schema

## Summary

The application uses four related InsForge tables. Required identity and ownership fields are strict. Profile content that a user may complete later remains nullable.

## Decision

### `profiles`

| Field | Type | Rule |
|---|---|---|
| `id` | `uuid` | Primary key, foreign key to the authenticated user, required |
| `email` | `text` | Required display copy, refreshed from current auth identity on profile save, never used for authorization |
| `full_name` | `text` | Nullable |
| `phone` | `text` | Nullable |
| `location` | `text` | Nullable |
| `current_title` | `text` | Nullable |
| `experience_level` | `text` | Nullable, check `junior`, `mid`, `senior`, `lead` |
| `years_experience` | `integer` | Nullable, check zero or greater |
| `skills` | `text[]` | Required, default empty array |
| `industries` | `text[]` | Required, default empty array |
| `work_experience` | `jsonb` | Required, default empty array |
| `education` | `jsonb` | Nullable |
| `job_titles_seeking` | `text[]` | Required, default empty array |
| `remote_preference` | `text` | Nullable, check `remote`, `onsite`, `hybrid`, `any` |
| `preferred_locations` | `text[]` | Required, default empty array |
| `salary_expectation` | `text` | Nullable |
| `cover_letter_tone` | `text` | Nullable, check `formal`, `casual`, `enthusiastic` |
| `linkedin_url` | `text` | Nullable |
| `portfolio_url` | `text` | Nullable |
| `work_authorization` | `text` | Nullable, check `citizen`, `permanent_resident`, `visa_required` |
| `resume_pdf_url` | `text` | Nullable, check value equals `id::text || '/resume.pdf'`, never a signed or public URL |
| `is_complete` | `boolean` | Required, default false |
| `created_at` | `timestamptz` | Required, database clock default |
| `updated_at` | `timestamptz` | Required, database clock default and automatic update trigger |

### `agent_runs`

| Field | Type | Rule |
|---|---|---|
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `user_id` | `uuid` | Required, foreign key to `profiles.id`, cascade delete |
| `status` | `text` | Required, check `running`, `completed`, `failed` |
| `job_title_searched` | `text` | Required |
| `location_searched` | `text` | Nullable |
| `jobs_found` | `integer` | Required, default zero, check zero or greater |
| `started_at` | `timestamptz` | Required, database clock default |
| `completed_at` | `timestamptz` | Nullable, set once by the run transition trigger |

Unique `(id, user_id)` supports owner matching foreign keys. Add indexes on `(user_id, started_at desc)` and `(user_id, status)`. A before insert trigger rejects any status other than `running` and any non null `completed_at`. A before update trigger keeps `completed_at` null while running, sets it from the database clock on the first terminal transition, and prevents later changes to terminal `status` or `completed_at`.

### `jobs`

| Field | Type | Rule |
|---|---|---|
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `run_id` | `uuid` | Nullable |
| `user_id` | `uuid` | Required, foreign key to `profiles.id`, cascade delete |
| `external_id` | `text` | Nullable provider job identifier |
| `source` | `text` | Required, check `search`, `url` |
| `source_url` | `text` | Required |
| `external_apply_url` | `text` | Required, initially the Adzuna redirect URL, later replaceable with a resolved employer URL |
| `title` | `text` | Required |
| `company` | `text` | Required |
| `location` | `text` | Nullable |
| `salary` | `text` | Nullable |
| `job_type` | `text` | Nullable, check `fulltime`, `parttime`, `contract` |
| `about_role` | `text` | Required |
| `responsibilities` | `text[]` | Required, default empty array |
| `requirements` | `text[]` | Required, default empty array |
| `nice_to_have` | `text[]` | Required, default empty array |
| `benefits` | `text[]` | Required, default empty array |
| `about_company` | `text` | Nullable |
| `match_score` | `integer` | Nullable, check zero through 100 |
| `match_reason` | `text` | Nullable |
| `matched_skills` | `text[]` | Required, default empty array |
| `missing_skills` | `text[]` | Required, default empty array |
| `company_research` | `jsonb` | Nullable |
| `found_at` | `timestamptz` | Required, database clock default |

The composite foreign key `(run_id, user_id)` references `agent_runs(id, user_id)` and uses cascade delete. A null `run_id` and the allowed `url` source are schema compatibility only. They do not build a manual import workflow. Unique `(id, user_id)` and `(id, run_id, user_id)` support log owner matching. Add indexes on `(user_id, found_at desc)`, `(user_id, match_score desc)`, and `(run_id)`. Add a partial unique index on `(user_id, source, external_id)` where `external_id` is not null. Feature 10 upserts repeated Adzuna results against this identity.

### `agent_logs`

| Field | Type | Rule |
|---|---|---|
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `run_id` | `uuid` | Required |
| `user_id` | `uuid` | Required, foreign key to `profiles.id`, cascade delete |
| `message` | `text` | Required |
| `level` | `text` | Required, check `info`, `success`, `warning`, `error` |
| `job_id` | `uuid` | Nullable |
| `created_at` | `timestamptz` | Required, database clock default |

The composite foreign key `(run_id, user_id)` references `agent_runs(id, user_id)` and uses cascade delete. The composite foreign key `(job_id, run_id, user_id)` references `jobs(id, run_id, user_id)` and uses cascade delete. This ensures a linked job belongs to the same run as the log. Add indexes on `(run_id, created_at)` and `(user_id, created_at desc)`.

## Key rules

* Use `gen_random_uuid()` for all non identity primary keys.
* Use checks rather than database enum types so allowed values can change through ordinary migrations.
* Add `jsonb_typeof` checks. `work_experience` is an array. `education` is null or an object. `company_research` is null or an object.
* One shared trigger sets `updated_at` to the database clock before each profile update.
* One run state trigger requires inserts to start as `running` with null `completed_at`. It allows `running` updates, permits only `running` to `completed` or `failed`, sets terminal time from the database clock, and rejects later changes to terminal `status` or `completed_at`.
* The canonical company field is `jobs.company`. Later code must not invent `company_name`.
* Adzuna only guarantees a description snippet. Structured job arrays default empty and represent unknown values until a later extractor supplies them. `about_role` stores the snippet.
* Do not persist completion percentage or missing field lists. Feature 06 derives them from profile values.
* Do not add generated or tailored resume content or generated cover letter content. `cover_letter_tone` remains profile preference data only.

## Rationale

Relational constraints express the real ownership graph and prevent orphan or cross user relationships. Nullable profile content supports gradual completion. Check constraints keep invalid stable values out without introducing rigid database enum types.
