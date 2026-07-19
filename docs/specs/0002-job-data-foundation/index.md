# 0002. Job data foundation

**Date**: 2026-07-19
**Status**: Accepted

## Summary

JobPilot will create one versioned InsForge migration for its four application tables and one private resume bucket. Database constraints and row level security will enforce relational ownership even when application code makes a mistake. Feature 06 will own resume upload validation and per user storage access through an authenticated server path because current InsForge storage does not expose object row policies or bucket media and size constraints.

## Structure

1. [Relational schema](0001-relational-schema.md), defines the tables, fields, relationships, constraints, and indexes.
2. [Access control](0002-access-control.md), defines ownership, row level security, and deletion behavior.
3. [Resume storage](0003-resume-storage.md), defines the private bucket and the Feature 06 storage boundary.

The children form one migration contract. A build is incomplete unless all three decisions are applied and verified together.

## Requirements

**User stories**:

* As a signed in user, I want my profile to accept partial information so that I can complete it over time.
* As a signed in user, I want my relational data isolated from every other user and resume storage kept private until its owner access path is built.
* As a developer, I want one versioned migration so that each environment has the same data foundation.

**Acceptance criteria**:

* **AC-1**: `insforge/migrations/202607190001_job_data_foundation.sql` creates `profiles`, `agent_runs`, `jobs`, and `agent_logs` with the fields, constraints, foreign keys, triggers, and indexes defined by this spec.
* **AC-2**: A new profile can contain only its identity fields, while every optional profile field remains nullable and can be filled later.
* **AC-3**: Database policies deny every cross user read, insert, update, and delete attempt on all four tables.
* **AC-4**: Deleting a profile removes its runs, jobs, and logs through database cascades without leaving orphan rows.
* **AC-5**: Feature 04 creates a private `resumes` bucket. It exposes no public object URL and adds no client upload or download path. Feature 06 owns the authenticated server storage boundary, exact `{user_id}/resume.pdf` key, 10 MiB limit, declared `application/pdf` check, and `%PDF-` prefix check.
* **AC-6**: Applying the versioned migration once through the InsForge migration service against a clean environment succeeds, and `docs/specs/0002-job-data-foundation/verify.md` proves tables, constraints, triggers, indexes, policies, cascades, and private bucket configuration with named assertions.
* **AC-7**: The schema contains no generated or tailored resume content, generated cover letter content, manual job import workflow, soft delete, or stored completion percentage fields. `cover_letter_tone` remains profile preference data for a future explicitly designed feature.

## Decision

**Chosen option**: One migration with database enforced ownership

Create the full current scope data foundation now. Keep optional profile fields nullable, use database constraints for stable rules, use row level security for ownership, and keep resume objects private.

No community implementation skill is installed for InsForge. The build must use the configured InsForge documentation and migration service. The confirmed backend contract is PostgreSQL with `auth.users(id uuid)`, `auth.uid()`, `storage.buckets(name text, public boolean)`, and no current bucket columns for media or size limits and no storage object row level policies. Feature 04 must not invent Supabase storage policy APIs that InsForge does not expose.

## Feature design

**Data model sketch**:

| Entity | Primary key | Ownership | Main relationship |
|---|---|---|---|
| `profiles` | `id uuid` | `id` equals the authenticated user ID | One profile owns many runs, jobs, and logs |
| `agent_runs` | `id uuid` | Required `user_id` | Many runs belong to one profile |
| `jobs` | `id uuid` | Required `user_id` | Many jobs belong to one profile, and optionally one run |
| `agent_logs` | `id uuid` | Required `user_id` | Many logs belong to one profile, one run, and optionally one job |

The complete field contract is in [Relational schema](0001-relational-schema.md).

**State transitions**:

* `agent_runs` inserts start as `running` with null `completed_at`. While running, ordinary fields may update and `completed_at` remains null. The first transition to `completed` or `failed` overwrites `completed_at` with the database clock. A terminal run may update non state fields, but its `status` and `completed_at` cannot change.
* A profile is incomplete until Feature 06 validates its required business fields. This feature stores only `is_complete`; it does not define the later form validation rule.
* A job research dossier is absent when `company_research` is null and present when it contains the Feature 13 object.

**API surface**:

This feature exposes no runtime endpoint or Server Action. Its interface is the committed migration, the resulting InsForge tables, and the storage bucket. Later features access them through the authenticated InsForge server client.

**Value sourcing**:

| Action | Value produced | Source |
|---|---|---|
| Create profile | `id`, `email`, timestamps, `is_complete` | Authenticated user ID and current auth email from spec 0001, database defaults for timestamps and `false` |
| Create agent run | Owner, search inputs, status, start time | Authenticated user ID, validated request values, `running`, database clock |
| Save job | Owner, run link, provider job identity, source, job details, match data, found time | Authenticated user ID, current run, Adzuna `id` and result, matching result, database clock |
| Write agent log | Owner, run, optional job, message, level, time | Current user and run context, application message, constrained level, database clock |
| Configure resume storage | Bucket name and visibility | Fixed `resumes` name and `public = false` in InsForge storage configuration |
| Upload resume in Feature 06 | Owner key, validated size, declared media type, and file prefix | Verified current user ID, fixed filename, file size at most 10,485,760 bytes, declared `application/pdf`, and first five bytes equal to `%PDF-` |
| Delete profile relational data | Rows to remove | Profile foreign keys with cascade behavior |

**Key invariants**:

* Every application row has exactly one owner.
* A child row owner must match the owner of every referenced parent row.
* A log with a job link must reference a job from the same run.
* `match_score` is null before scoring or an integer from 0 through 100.
* `source` is `search` or `url`. Current product flows create only `search` jobs.
* `agent_runs.status` and `agent_logs.level` accept only their named values.
* A run is inserted only as `running` with null `completed_at`. Terminal transition time comes only from the database trigger. Terminal `status` and `completed_at` are immutable.
* `work_experience` is always a JSON array. `education` and non null `company_research` are always JSON objects.
* `profiles.resume_pdf_url` is null or exactly `id::text || '/resume.pdf'`, enforced by a database check.
* Feature 04 creates only a private resume bucket. It does not claim per object storage controls that current InsForge does not expose.
* Feature 06 must keep all resume operations behind an authenticated server path and validate the exact owner key, 10 MiB size, declared media type, and `%PDF-` prefix before upload. The prefix is a basic file signature check, not full PDF validation.
* Completion percentage and missing fields are derived by Feature 06 and are not persisted.

**Security model**:

JobPilot is a single user product with no team roles. Row level security is enabled and forced on all application tables. Policies use the InsForge authenticated JWT subject through `auth.uid()`. The authenticated server client is subject to these policies. Only the migration administrator may bypass them. Inserts must set the same owner, and updates cannot transfer ownership. Parent owner matching is enforced by composite foreign keys where needed. The resume bucket is private, but current InsForge storage does not provide the object owner policy assumed by the earlier draft. Application queries must still include `user_id` as a clear secondary guard.

The schema stores personal profile data and the bucket will later store resumes. No formal regulatory certification is in scope, but least privilege is required because this is personally identifiable information. Feature 04 permits direct profile row deletion only as relational data deletion, not as complete account deletion. A later account deletion flow must remove the resume object first, then delete the profile.

**Critical test scenarios**:

* Happy path: apply the migration, create one partial profile, one running run, one job, and one log as the same user. Confirm the private bucket exists, verifies **AC-1**, **AC-2**, **AC-5**, and **AC-6**.
* Failure case: insert a terminal run, supply `completed_at`, reverse a terminal run, change terminal time, save invalid JSON, use a score outside zero through 100, link a log to a job from another run, and store an invalid resume key, verifies **AC-1**.
* Permission case: a second authenticated user attempts every relational operation against the first user data, verifies **AC-3**.
* Deletion case: delete the profile and confirm all owned rows are gone, verifies **AC-4**.
* Scope case: inspect the schema and confirm future feature and derived completion fields are absent, verifies **AC-7**.

## Build plan

The project normally builds visible UI before logic. Feature 04 is the required data foundation and has no UI, so the plan uses the smallest usable whole: schema, ownership, storage, then proof.

1. [x] Create `insforge/migrations/202607190001_job_data_foundation.sql` with the four tables, field types, defaults, checks, triggers, foreign keys, and indexes from the confirmed model, satisfies **AC-1**, **AC-2**, **AC-4**, and **AC-7**.
2. [x] Add row level security and parent owner constraints for all four tables, satisfies **AC-3** and **AC-4**.
3. [x] Create the private `resumes` bucket through the InsForge storage service. Do not add a client storage path or unsupported storage object policies, satisfies **AC-5**.
4. [ ] Write `verify.md`, apply the migration through the InsForge migration service, and run its positive, invalid value, state transition, cross user, cascade, deduplication, and storage assertions, satisfies **AC-1** through **AC-7**. All assertions except cross user behavior through two real authenticated clients have passed.
5. [x] Run lint, strict TypeScript, and the production build to confirm the migration artifacts do not break the application, satisfies **AC-6**.

## Consequences

**Positive**:

* Later features receive one stable data contract.
* Database ownership rules limit damage from a missing application filter.
* Users can save partial profiles and return later.
* Direct cascades make account data deletion predictable.

**Negative / tradeoffs**:

* Composite ownership constraints add migration detail and require child writes to carry `user_id`.
* Private resumes require a verified server access path in Feature 06 instead of public URLs.
* Adding future fields will require later migrations.

**Neutral**:

* Profile creation remains part of Feature 06, where it will use an idempotent upsert with `profiles.id` as the conflict target. It copies the current auth email on every successful profile save so the display copy follows identity changes. A database auth trigger is not added because the project does not yet document a stable InsForge auth trigger contract.
* The allowed `url` source value reserves schema compatibility, but no manual import interface is built.
* Empty structured job arrays mean the provider did not supply structured values. They do not mean the job explicitly has no responsibilities, requirements, benefits, or preferred skills.

## Follow-up

* [ ] Feature 06 must define the required profile fields that set `is_complete` and compute completion details at read time.
* [ ] Feature 06 must implement the authenticated server storage boundary. It must enforce the exact owner key, 10 MiB size, declared `application/pdf`, and first five upload bytes equal to `%PDF-` before calling InsForge storage. It must verify current InsForge private bucket access semantics before exposing download or replacement.
* [ ] Feature 13 must validate the exact `company_research` JSON shape before writing it.
* [ ] Account deletion must remove the private resume object before deleting the profile because relational cascades cannot delete storage objects.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
