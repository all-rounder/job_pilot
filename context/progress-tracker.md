# Progress Tracker
Dashboard stat cards now use real data

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 5, Dashboard
**Last completed:** 16 Recent Activity Real Data, implementation, lint, strict TypeScript, production build, and authenticated runtime verification passed
**In progress:** None
**Next:** 17 Analytics Charts PostHog Data

---

## Progress

Phase 5 Feature 16 Recent Activity: [x] Fully passed. The existing authenticated browser tab confirmed both search and company research activity rows.

### Phase 1 — Foundation

- [x] 01 Homepage
- [x] 02 Auth
- [x] 03 PostHog Initialization
- [x] 04 Database Schema

### Phase 2 — Profile Page

- [x] 05 Profile Page — Full UI
- [x] 06 Profile Save Logic
- [x] 07 AI Profile Extraction from Resume
- [x] 08 Resume PDF Generation from Profile

### Phase 3 — Find Jobs Page

- [x] 09 Find Jobs Page — Full UI
- [~] 10 Adzuna Job Discovery, implementation complete, authenticated runtime verification passed
- [~] 11 Filter + Sort + Pagination, implementation complete, lint, TypeScript, production build, authenticated listing, URL filters, sorting, pagination, empty state, and signed out denial verified. The database failure retry state remains deferred. See [Feature 11 AC-8](../docs/specs/0008-database-backed-job-listing.md#requirements): a failed `GET /api/jobs` database read must preserve the active filters and show the safe error message with a `Try again` action.

### Phase 4 — Job Details Page

- [x] 12 Job Details Page — Full UI
- [~] 13 Company Research Agent, implementation complete, runtime verification pending

### Phase 5 — Dashboard

- [~] 14 Dashboard Page — Full UI, implementation complete, lint, TypeScript, and production build passed, runtime verification pending
- [x] 15 Stats Bar — Real Data
- [x] 16 Recent Activity — Real Data, implementation complete, lint, strict TypeScript, and production build passed. Authenticated search and company research activities were confirmed in the existing authenticated browser tab. Historical research runs with null `agent_logs.job_id` resolve their company through the owner-scoped job title fallback.
- [ ] 17 Analytics Charts — PostHog Data

---

## Decisions Made During Build

- Feature 02 uses the official InsForge SSR flow: Server Action OAuth start, one server callback exchange, HTTP only refresh and PKCE cookies, `proxy.ts` refresh, and protected Server Component checks.
- Next.js 16 `proxy.ts` is an optimistic redirect and refresh layer, never the sole authorization boundary.
- Feature 03 uses Next.js client instrumentation plus one shared React provider. Protected routes identify the current InsForge user, and sign out resets browser identity before ending the session.
- Feature 04 uses one versioned PostgreSQL migration, forced row level security, and composite owner keys for relational data. Feature 06 owns authenticated resume access and PDF validation.
- Feature 06 uses one atomic owner scoped profile save function, derives completion from normalized profile values, records first completion once, and keeps one active private resume behind the authenticated `/api/resume` route.
- Feature 15 uses a protected server side InsForge read of the current user's jobs, summarizes total jobs, average scored match rate, researched companies, and jobs from the previous seven days, then passes the existing stat view model to the dashboard. The decision is recorded and accepted in [0011 Dashboard Stats Bar](../docs/specs/0011-dashboard-stats-bar.md). No new endpoint or migration was needed.

---

## Notes

- Feature 02 passed lint, TypeScript, production build, and runtime verification. Google and GitHub OAuth both return to `/dashboard`; refresh preserves the session; sign out clears it; signed out protected routes redirect to `/login`.
- The project intentionally uses a `typecheck+verify` quality gate without a test runner, recorded in `test-preferences.json`.
- Feature 03 passed lint, strict TypeScript, and a production build. Event capture remains limited to the four names in `code-standards.md`; each owning feature will add its events when built.
- Feature 05 delivers the complete responsive `/profile` facade from `context/designs/profile.png`, with typed placeholder data ready for Feature 06 to replace. Lint, strict TypeScript, production build, desktop runtime structure, responsive 375px layout, and native form control interaction passed.
- Feature 04 migration and private `resumes` bucket are live. Schema, constraint, cascade, storage, and two real authenticated user RLS assertions passed, along with lint, strict TypeScript, the production build, and `/check verify`.
- Feature 06 replaced all profile placeholders with authenticated reads and explicit partial saves. Valid PDF upload, private read, replacement, invalid file preservation, deletion, immutable first completion, lint, strict TypeScript, production build, and signed out denial passed runtime verification.
- Feature 07 adds authenticated extraction from the active private PDF with externalized `pdf-parse`, GPT-4o Structured Outputs, strict Zod validation, an overwrite warning, and review before save. Lint, strict TypeScript, production build, synthetic PDF parsing, live GPT-4o schema parsing, signed out denial, the active resume action, overwrite confirmation, and authenticated form population passed. The engineer confirmed the complete extraction journey in the real profile page.
- Feature 08 adds authenticated generation from the complete saved profile with GPT-4o Structured Outputs, a deterministic `@react-pdf/renderer` A4 template, one page validation, unique owner scoped storage keys, exact returned key activation, prior object cleanup, and immediate view and extraction access. User runtime verification plus live database and storage inspection confirmed one active pointer, one matching object, and no duplicate orphan files. Lint, strict TypeScript, production build, live GPT-4o generation, PDF parsing, and visual inspection passed.
- Feature 09 adds the protected `/find-jobs` UI facade from `context/designs/find-jobs.png`, with typed mock results, local filtering, sorting, search feedback, responsive table overflow, and pagination. Real discovery remains Feature 10.
- Feature 10 adds the authenticated Adzuna search route, GPT-4o scoring, owner scoped persistence, duplicate safe retries, partial result warnings, PostHog events, and real search wiring in the Find Jobs facade. Lint, strict TypeScript, production build, authenticated live search, signed out denial, and duplicate retry verification pass. Duplicate retries now return the existing owner scoped jobs for display without creating new rows. AC-9 partial scoring and AC-10 provider failure paths are implemented but their forced runtime scenarios are deferred until after the remaining features are built. Feature 10 remains incomplete and must be revisited before final acceptance.
- Feature 11 replaces the local Find Jobs listing with owner scoped InsForge reads through the protected server page and `GET /api/jobs`. URL state uses `q`, `match`, `sort`, and `page`, with server filtering, deterministic sorting, count metadata, safe page bounds, and eight row pages for testing. Loading, empty, retryable error, refresh, and browser navigation behavior are implemented. Lint, strict TypeScript, and production build pass. Authenticated runtime verification remains for `/check verify`.
- Feature 12 adds the owner scoped `/find-jobs/[id]` details route and complete job details surface from `context/designs/job-details.png`. It renders real saved job data for the header, metadata, match reasoning, skills, description, and apply links. Company research remains the empty state owned by Feature 13. Find Jobs company and role cells now link to details. `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass.
- Feature 13 adds the owner scoped synchronous `/api/agent/research` route, one existing `agent_runs` row per research invocation, safe related logs, Browserbase plus Stagehand company browsing, GPT 4o dossier synthesis, validated atomic job persistence, refresh protection, PostHog capture, and interactive empty, loading, error, populated, and refresh states on job details. `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass. Authenticated runtime verification remains for `/check verify`.
- Feature 13 runtime verification, recorded 2026-07-22: the authenticated job details page loaded, the existing dossier rendered, and Research again showed loading, completed successfully in about 15 seconds, replaced the dossier, and showed a success message. The browser console had no warnings or errors. Database record inspection, fallback, provider failure, concurrency, authentication ownership denial, and analytics delivery were not exercised because this run had no safe controlled fixtures or direct inspection path. These are verification gaps, not confirmed defects. See [Feature 13 verification](../docs/reviews/0009-company-research-agent-verification.md). The earlier Chrome localhost access blocker is resolved.
- Feature 14 replaces the authentication placeholder with the responsive dashboard facade from `context/designs/dashboard.png`, typed mock stats and activity, accessible inline charts, and empty state branches. Lint, strict TypeScript, and production build pass. Authenticated runtime verification remains for `/check verify` before Feature 14 is complete.
- Feature 14 runtime verification, recorded 2026-07-22: authenticated Chrome access succeeded after the server was started. Desktop rendering, four stat cards, recent activity, all three chart areas, navigation, desktop sign out, 375 pixel responsive layout, no horizontal overflow, and no browser console warnings or errors passed. The empty data state was not exercised because no controlled empty fixture was available. Full keyboard focus behavior was also not exercised. See [Feature 14 verification](../docs/reviews/0010-dashboard-page-verification.md).
- Feature 15 runtime verification, recorded 2026-07-22: authenticated Chrome rendered live dashboard values, the four cards showed 18 total jobs, 18% average match rate, 1 researched company, and 18 jobs this week. The Find Jobs page independently showed 18 total results. A full dashboard screenshot was captured and the browser console had no errors or warnings. The accepted implementation decision is documented in [0011 Dashboard Stats Bar](../docs/specs/0011-dashboard-stats-bar.md).
- Feature 16 verification, recorded 2026-07-22: `npm run lint`, `npx tsc --noEmit`, and `npm run build` passed. Authenticated dashboard runtime showed five merged search activities with relative timestamps and no browser console warnings or errors. Company research was rerun successfully for Advanced Navigation and the dossier refreshed, but its activity row did not appear because `isAgentRunRow` required `jobs_found` to be a number even though research runs may omit the field. The guard now accepts null and omitted values and defaults search copy to zero. A clean runtime recheck is still required. Empty-state, forced database failure, and cross-user ownership fixtures were not exercised.
- Feature 11 runtime verification passed for the authenticated listing, text and match filters, sorting, eight row pagination, URL state, browser history, empty state, and signed out access. `npm run lint`, `npx tsc --noEmit`, and `npm run build` passed. The database failure retry state described in [Feature 11 AC-8](../docs/specs/0008-database-backed-job-listing.md#requirements) was not forced. This means intentionally causing the jobs database read to fail, confirming the safe error message appears, confirming the current filters remain visible, and confirming `Try again` retries the listing. It remains the only deferred verification scenario before final phase acceptance.

_Add notes here as the build progresses — workarounds, patterns, anything that differs from the context files._
