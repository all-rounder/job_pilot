# 0007. Adzuna job discovery

**Date**: 2026-07-20
**Status**: In Progress

**Verification note**: Feature implementation and the main authenticated journey are complete. AC-9 partial scoring and AC-10 provider failure handling are implemented, but their forced runtime fault scenarios are intentionally deferred until the full feature set is built. Feature 10 must not be treated as fully accepted until those scenarios are exercised.

## Summary

Feature 10 connects the Find Jobs page to Adzuna. An authenticated user submits a job title and optional location, receives up to ten IT jobs, and gets an AI match score for each job based on the saved profile. New jobs are saved under an agent run and returned to the page for immediate display.

## Context

Feature 09 delivered the protected Find Jobs page with mock results. The next step is the first real discovery journey. The existing database already contains owner scoped `agent_runs`, `jobs`, and `agent_logs` tables, including a unique key for a user's source and external job ID.

The search calls two external services and handles profile data. It must keep credentials on the server, avoid cross user writes, tolerate individual scoring failures, and leave the user with a useful result when only part of a search succeeds.

> Premise note: A synchronous route that calls GPT 4o once for every result can become slow as provider latency grows. This feature keeps the synchronous flow because the current product contract expects one completed response, caps the search at ten results, and isolates the agent behind a small function so a later background run can replace it without changing the stored job shape.

## Requirements

**User stories**:

* As a signed in user, I want to search by role and location so that I can find relevant jobs.
* As a user with a partial profile, I want a search to use the saved information available so that I can still discover jobs while I finish my profile.
* As a user, I want each result scored and explained so that I can decide which jobs deserve attention.

**Acceptance criteria**:

* **AC-1**: An authenticated request to `POST /api/agent/find` accepts a non empty `jobTitle` and an optional `location`. Invalid JSON or an empty title returns `400` with a safe error.
* **AC-2**: The route resolves the current InsForge user on the server and reads only that user's profile. A signed out request returns `401`; the browser cannot provide a user ID or profile data for the operation.
* **AC-3**: The route allows a sparse saved profile, uses all available matching fields, and returns a warning when the saved profile has little matching information. A missing profile returns a safe `422` response.
* **AC-4**: A valid search creates one `agent_runs` row in `running` state before calling Adzuna. The run stores the submitted title and optional location.
* **AC-5**: The Adzuna request uses the configured credentials, the detected country, page `1`, `what`, `results_per_page=10`, `category=it-jobs`, and JSON content type. It omits `where` when location is empty and defaults the country to `au`. Recognizable `gb` and `ca` locations use those countries.
* **AC-6**: Each Adzuna result is mapped to the existing job shape, including external ID, title, company, location, salary estimate, job type, description snippet, redirect URL, source `search`, and the run owner.
* **AC-7**: GPT 4o scores each candidate result with strict validated JSON containing an integer `matchScore` from `0` to `100`, one paragraph `matchReason`, `matchedSkills`, and `missingSkills`. The prompt grounds the score in the saved profile and the Adzuna snippet, and does not allow invented profile facts.
* **AC-8**: Each successfully scored new result is inserted into `jobs`. A duplicate user's `search` result with the same Adzuna external ID is skipped rather than inserted again. The existing unique constraint remains the final protection against duplicates.
* **AC-9**: A search that completes with at least one saved or skipped result updates the run to `completed`. Individual scoring or insert failures are recorded as safe warning or error log entries, do not expose model output, and do not prevent other results from being processed. The response includes `partial` and counts for saved, skipped, and failed results.
* **AC-10**: An Adzuna failure, profile database failure, or run creation failure completes safely, marks a created run as `failed` when possible, and returns a retryable human readable error without storing incomplete jobs.
* **AC-11**: The successful response includes the run ID, detected country, saved job records for the current run, total counts, `strongMatchCount` using `MATCH_THRESHOLD`, the sparse profile warning when applicable, and a message suitable for the Find Jobs page.
* **AC-12**: The server captures `job_search_started` once per accepted search and `job_found` once per newly saved job. Each event includes `userId`; server PostHog uses immediate flush and shutdown. Missing analytics configuration does not fail discovery.
* **AC-13**: The Find Jobs page sends the real search request, locks the submit control while it runs, replaces mock rows with returned jobs on success, shows the returned counts and partial warning, and announces safe loading, empty, success, and error states.
* **AC-14**: The implementation passes lint, strict TypeScript, production build, and `/check verify` for the critical scenarios in this spec.

## Decision

Use one authenticated `POST /api/agent/find` route and a server side agent function. The route owns authentication, input validation, profile loading, run lifecycle, persistence, response mapping, and analytics orchestration. The agent module owns Adzuna country detection, Adzuna fetching, result mapping, and GPT 4o scoring. No new package or migration is needed.

The run remains synchronous for the first ten results. Partial work is represented by an existing `completed` run plus `agent_logs` entries and explicit response counts. This avoids a migration for a state that is only meaningful to the current operation while preserving an audit trail for later activity views.

**Implementation skills**: `develop` (`E:/GitHub/job_pilot/.agents/skills/develop/`), `check` (`E:/GitHub/job_pilot/.agents/skills/check/`)

## Feature design

**Data model sketch**:

| Entity | Fields and rules | Relationships |
|---|---|---|
| `profiles` | Existing row. `id` identifies the authenticated owner. Saved profile fields are nullable or arrays as defined by the existing migration. | One owner has many runs. |
| `agent_runs` | Existing row. `id`, `user_id`, `status`, `job_title_searched`, nullable `location_searched`, `jobs_found`, `started_at`, nullable `completed_at`. Starts as `running`; terminal status is `completed` or `failed`. | Belongs to one profile. One run has many jobs and logs. |
| `jobs` | Existing row. `id`, `run_id`, `user_id`, `external_id`, source fields, job fields, match fields, and `found_at`. Adzuna rows use source `search`; `external_id` is the Adzuna ID. | Belongs to one owner and one run. The composite foreign key prevents cross owner references. |
| `agent_logs` | Existing row. `run_id`, `user_id`, optional `job_id`, safe message, level, and timestamp. Never stores profile values, prompts, model output, or credentials. | Belongs to one run and optionally one job. |

The existing partial unique index on `(user_id, source, external_id)` prevents duplicate Adzuna jobs. No schema change is part of Feature 10.

**State transitions**:

`agent_run`: `running` to `completed` after the loop finishes, even when warning logs exist. `running` to `failed` when the external search, profile load, or unrecoverable persistence step prevents a usable result. Terminal states remain immutable under the existing database trigger.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/agent/find` | POST | `jobTitle:string` required, `location:string` optional | `runId`, `country`, `jobs`, `savedCount`, `skippedCount`, `failedCount`, `strongMatchCount`, `partial`, `warning`, `message` | Current InsForge user required | `400` invalid input, `401` signed out, `422` missing profile, `502` Adzuna or OpenAI failure, `500` database failure |

The route does not accept `userId`, profile data, country, API credentials, storage keys, or an idempotency key from the browser. A retry is safe because the database uniqueness constraint skips the same user and Adzuna external ID.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Validate search | Normalized title and location | Request JSON, trimmed on the server |
| Resolve owner | User ID | Authenticated InsForge session |
| Build match input | Candidate profile facts | Current user's `profiles` row |
| Choose country | `au`, `gb`, or `ca` | Recognized location terms, otherwise decided default `au` |
| Build Adzuna URL | App ID and app key | `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` on the server |
| Build Adzuna filters | Search title, optional location, IT category, page, and page size | Normalized request plus the fixed rules in this spec |
| Build job record | Job fields and source values | Adzuna result mapping and the current run and user IDs |
| Build match result | Score, reason, matched skills, missing skills | GPT 4o structured response grounded in the profile and Adzuna snippet |
| Count strong matches | Strong match total | Saved jobs whose score is at least `MATCH_THRESHOLD` from `lib/utils.ts` |
| Display result rows | Current run jobs | Successful insert responses, returned from the route |
| Display partial warning | Saved, skipped, and failed counts | Server loop counters and safe `agent_logs` entries |
| Capture analytics | User and search event properties | Authenticated user ID, normalized search, and saved job score |

**Key invariants**:

* Every database query and mutation is owner scoped.
* A job cannot reference a run owned by another user because the composite foreign key remains intact.
* Adzuna jobs always use source `search` and the Adzuna external ID.
* The `where` query parameter is absent when location is empty.
* No job is stored before its score passes schema validation.
* A duplicate result never creates a second row for the same user and source.
* Run completion is written after all result attempts finish.
* Safe operational metadata may be logged, but profile facts, model output, job descriptions, credentials, and request bodies are not logged.

**Security model**:

Only the authenticated owner may start a run through the route. The server creates the owner identity, reads the owner profile, and writes owner scoped runs, jobs, and logs through InsForge RLS. Adzuna and OpenAI secrets remain server side. Responses contain only the current user's returned jobs and safe error text. This feature handles personal employment data but has no regulated compliance scope beyond ordinary privacy and secret handling.

**Configuration required**:

* `ADZUNA_APP_ID`: server side Adzuna application ID.
* `ADZUNA_APP_KEY`: server side Adzuna application key.
* `OPENAI_API_KEY`: existing server side GPT 4o credential.
* `NEXT_PUBLIC_POSTHOG_KEY`: existing server side PostHog key source.
* `NEXT_PUBLIC_POSTHOG_HOST`: existing PostHog host.

**Critical test scenarios**:

* Happy path: an authenticated user searches for a title and location, receives Adzuna jobs, scores, persisted rows, analytics events, and visible results, verifies **AC-1** through **AC-13**.
* Sparse profile: a profile with only a few saved fields searches successfully and receives a warning, verifies **AC-3** and **AC-11**.
* Country and request rules: Australian default, recognized United Kingdom and Canadian locations, empty location omission, IT category, and ten result cap, verifies **AC-5**.
* Duplicate retry: submitting the same search again does not create duplicate user job rows, verifies **AC-8** and **AC-11**.
* Partial scoring: one invalid or failed score is logged while other jobs save and the response reports `partial`, verifies **AC-9** and **AC-11**.
* Provider failure: Adzuna or OpenAI failure returns a safe retryable error and leaves no incomplete job row, verifies **AC-9** and **AC-10**.
* Auth and ownership: signed out requests return `401`, and a request cannot submit another user's ID or write another user's data, verifies **AC-2** and **AC-10**.
* UI states: submit lock, success, empty, partial warning, and error states are announced and rendered without mock data after a successful search, verifies **AC-13** and **AC-14**.

## Build plan

The project uses a facade approach. Feature 09 already provides the UI shell, so this feature builds one complete server journey first, then activates the existing search controls and replaces mock rows with the returned persisted shape. Feature 11 will later move filtering, sorting, and pagination to database backed reads.

1. [x] Add shared agent types, profile projection types, Adzuna country detection, result mapping, safe salary and job type normalization, and the GPT 4o match schema, satisfying **AC-5**, **AC-6**, and **AC-7**.
2. [x] Add the authenticated Adzuna client using `category=it-jobs`, optional `where`, ten result limit, country default `au`, bounded fetch behavior, and safe provider errors, satisfying **AC-2**, **AC-5**, and **AC-10**.
3. [x] Add the GPT 4o scoring function with strict JSON validation, profile grounded prompts, `gpt-4o`, temperature `0.3`, and the existing response size convention, satisfying **AC-3**, **AC-7**, and **AC-10**.
4. [x] Add `POST /api/agent/find` with input validation, owner scoped profile and run creation, result scoring, duplicate safe inserts, warning logs, terminal run updates, safe response mapping, and PostHog lifecycle events, satisfying **AC-1** through **AC-12**.
5. [x] Wire the Find Jobs search controls to the route, add loading and error handling, replace mock rows with returned jobs, show counts and partial warnings, and preserve the existing local table behavior until Feature 11, satisfying **AC-11**, **AC-13**, and **AC-14**.
6. [ ] Verify lint, strict TypeScript, production build, authenticated runtime behavior, provider failure handling, duplicate retries, privacy safe logs, analytics shutdown, and every critical scenario through `/check verify`, then update `context/ui-registry.md` and `context/progress-tracker.md`, satisfying **AC-14**.

## Consequences

**Positive**:

* Users get real jobs and explainable match scores in the existing page.
* Existing database constraints provide idempotent retries without a migration.
* Partial results remain useful when one model call fails.
* The agent boundary can later move to background execution without changing the persisted job contract.

**Negative and tradeoffs**:

* A synchronous search can feel slow because it performs several model calls.
* GPT 4o scoring adds cost for every Adzuna result.
* Adzuna descriptions are snippets, so match reasoning is limited by the available text.
* Returning current run jobs supports the facade but duplicates some later database read work in Feature 11.

**Neutral**:

* Existing runs with warning logs still have the terminal status `completed`; callers use the explicit `partial` response and logs for detail.
* No new library, migration, table, or storage object is introduced.

## Follow-up

* [ ] Feature 11 should replace the returned run list with owner scoped database reads, URL backed filters, sorting, and pagination.
* [ ] If synchronous latency becomes a user problem, introduce a background run worker while preserving the `agent_runs` and `jobs` contract.

## Options considered

### Option 1: Synchronous route with bounded partial processing

The route fetches at most ten jobs, scores them one by one, persists each successful result, and returns the current run. This is the recommended option because it fits the existing UI contract and needs no queue or migration. Its cost is provider latency during one request.

### Option 2: Background run with polling

The route creates a run and returns immediately while a worker processes Adzuna and OpenAI work. This improves request latency and resilience, but adds queue, worker, polling, and deployment concerns before the product has proven search volume.

### Option 3: Adzuna results without AI scoring

The route saves jobs immediately and scores them later. This is simpler and faster, but it breaks the core value of the Find Jobs page because match scores and explanations would not be available after search.

## Rationale

The existing product already chose Adzuna, GPT 4o, InsForge, and a synchronous route in the build plan. Reusing those decisions keeps the feature small and operationally understandable. The database's unique index makes retries safe, while warning logs and explicit counts provide honest partial results without weakening the existing run state machine. Defaulting to `au` follows the requested product audience while still supporting the documented alternative countries.
