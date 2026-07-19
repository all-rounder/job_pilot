# InsForge data foundation

- Governing spec: `docs/specs/0002-job-data-foundation/index.md`.
- Keep database changes as versioned SQL files in `insforge/migrations/`; never edit an already applied migration.
- All application tables use forced row level security with owner scoped select, insert, update, and delete policies.
- Preserve composite owner foreign keys when relating runs, jobs, and logs so referenced rows cannot cross users.
- The `resumes` bucket is private infrastructure only. Feature 06 owns authenticated object access, the `{user_id}/resume.pdf` key, the 10 MiB limit, declared MIME validation, and the `%PDF-` prefix check.
- Verify migrations through the InsForge migration service and the assertions in the governing spec's `verify.md`.

_Drafted by /sync from the introducing change, worth a quick human pass._
