# Feature 04 verification

Run this procedure against an empty disposable InsForge environment. Apply `insforge/migrations/202607190001_job_data_foundation.sql` through the InsForge migration service first.

## Schema assertions

1. `SCHEMA-01`: confirm all four tables, named columns, defaults, checks, triggers, foreign keys, unique constraints, and indexes match the spec.
2. `RLS-01`: confirm row level security is enabled and forced on every table.
3. `STORAGE-01`: confirm the `resumes` bucket exists with `public = false` and no application client storage path was added.
4. `SCOPE-01`: confirm no prohibited fields from AC-7 exist. Confirm `source = 'url'` and nullable `run_id` are compatibility values only.

## Data assertions

1. `PROFILE-01`: as user A, create a profile with only `id` and `email`. Confirm nullable fields remain null, arrays use empty defaults, and `is_complete` is false.
2. `RUN-STATE-01`: confirm a run can be inserted only as `running` with null `completed_at`. Complete it and confirm the database sets `completed_at`. Confirm terminal status and time cannot change. Confirm non state fields may still update.
3. `JOB-IDENTITY-01`: create a job with an Adzuna `external_id`, then repeat the upsert using the partial index predicate. Confirm only one owned job exists.
4. `CONSTRAINT-01`: confirm invalid stable values, invalid JSON kinds, and scores outside zero through 100 are rejected.
5. `RELATION-01`: confirm a log cannot link a job from a different run or user.

## Permission assertions

1. `RLS-02`: through the authenticated server client, attempt select, insert, update, and delete as user B against every user A row. Confirm each operation returns no row or an RLS error and changes nothing.
2. `RLS-03`: confirm anonymous access to every application table is denied.

## Deletion assertions

1. `CASCADE-01`: delete a job and confirm its linked logs are deleted.
2. `CASCADE-02`: delete a run and confirm its jobs and logs are deleted.
3. `CASCADE-03`: recreate the graph, delete the profile, and confirm all relational children are deleted without an orphan or constraint error.
4. `STORAGE-BOUNDARY-01`: confirm any resume object remains until a later account deletion flow removes it. Direct profile deletion is relational data deletion, not complete account deletion.

## File assertions

1. `PROFILE-KEY-01`: confirm `profiles.resume_pdf_url` accepts null or exactly `{profile.id}/resume.pdf` and rejects every other value.
2. `STORAGE-02`: confirm Feature 04 contains no upload, download, replacement, deletion, or signing endpoint and stores no signed or public URL.
3. In Feature 06 verification, test owner path, size, declared media type, short file, `%PDF-` prefix, replacement, cross user access, and account deletion behavior through the server storage boundary.
