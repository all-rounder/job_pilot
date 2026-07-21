**Status**: In Progress

## Summary

Feature 13 lets a signed in job seeker research a saved job's company before applying. One server request gathers public company information, combines it with the saved job and profile, and stores a validated briefing on the job. Existing run and log tables record operational history, while the job dossier remains the only user facing research state.

## Context

The job details page already has a Company Research empty state. The user needs specific company context, role context, and candidate preparation in one place before applying.

The project already uses InsForge for authenticated data, Browserbase and Stagehand for public website browsing, OpenAI GPT 4o for structured synthesis, Zod for validation, and PostHog for the existing analytics event. The database already contains `jobs.company_research`, `agent_runs`, and `agent_logs`.

This feature is a linked product feature even though no `docs/scope/` file exists in the repository. The existing progress tracker identifies it as the next feature. The build approach is assumed to be Tracer Bullet, because no project approach is recorded. The implementation should prove one complete research journey first, then harden its failure paths and UI states.

## Options considered

### Synchronous route with one Browserbase session

The page waits for the research request and receives the completed dossier. It has the fewest moving parts and fits the existing two minute Browserbase session, but the browser remains open for the request duration.

### Background run with polling

The request starts work and the page polls an operation. This better separates long work from the page request, but adds state, polling, expiry, and recovery behavior that the current product does not need.

### Background run with realtime updates

Realtime status could show detailed progress. It adds the most infrastructure and does not match the current product scope, which excludes a live agent feed.

## Decision

Use a synchronous `POST /api/agent/research` route. It accepts a job ID and an optional explicit refresh flag. It creates one new row in the existing `agent_runs` table for every invocation and related safe entries in `agent_logs`. It writes `jobs.company_research` only after the complete dossier passes application validation.

Use one Browserbase session with Stagehand. Resolve the employer homepage from the Adzuna redirect with a server side fetch, fall back to a company name URL when necessary, extract the homepage and at most three useful internal pages, close the browser in `finally`, then synthesize with GPT 4o after the browser closes.

An existing dossier is shown without starting research. Refresh requires `force: true`. A refresh failure leaves the prior dossier unchanged. If no dossier exists, a failure leaves the column null and returns a retryable error.

**Implementation skills**: none detected in the project context that materially shape this feature.

## Requirements

* **AC-1**: An authenticated owner can click Research Company for a saved job and receive a complete dossier built from the company's public website, the saved job row, and the owner's profile.
* **AC-2**: The research request creates one `agent_runs` row and related safe `agent_logs` rows in the existing tables, and never logs prompts, profile values, model output, secrets, or scraped page contents.
* **AC-3**: The dossier is validated before persistence and contains non empty `companyOverview`, `whyThisRole`, and the arrays `techStack`, `culture`, `yourEdge`, `gapsToAddress`, `smartQuestions`, `interviewPrep`, and `sources`.
* **AC-4**: The saved dossier is written to the owner scoped job's `company_research` column only after synthesis succeeds. A successful refresh replaces the prior dossier atomically.
* **AC-5**: If the employer site cannot be derived, is unreachable, or has no meaningful content, synthesis still runs from the saved job and profile without unsupported company claims.
* **AC-6**: A job with an existing dossier displays it and does not research again until the user explicitly requests refresh with `force: true`.
* **AC-7**: The job details page disables the research control during the request, exposes loading, success, and human readable error states, and renders the returned dossier without a page navigation.
* **AC-8**: Only the authenticated owner can research or read a job. Missing authentication returns 401, an unknown or non owned job is not disclosed, and malformed input returns 400.
* **AC-9**: A second active request for the same job returns 409 and cannot overwrite a successful concurrent result. A Browserbase or OpenAI timeout returns a retryable generic error and leaves any prior dossier unchanged.
* **AC-10**: A successful saved dossier emits the existing `company_researched` event with `userId`, `jobId`, and `company` after persistence succeeds.

## Rationale

The synchronous design is the smallest complete user journey and uses infrastructure the project already owns. A background workflow would create more durable state and more failure modes without a current product requirement for progress streaming. Keeping the dossier on the job preserves the existing data boundary and lets the details page render it with its existing owner scoped read.

The separate run and log rows are operational records, not a second product data model. They satisfy the established agent error handling convention while keeping the final job state simple. Atomic replacement and explicit refresh prevent a failed or stale request from destroying useful prior research.

## Feature design

**Data model sketch**:

| Entity | Fields and constraints | Relationship |
|---|---|---|
| `profiles` | Existing `id` primary key, candidate skills, experience, and work history are read only for this feature | One profile owns many jobs and agent runs |
| `jobs` | Existing `id` primary key and `user_id` owner. `company_research` is nullable JSONB and remains null or a validated object | Many jobs belong to one profile |
| `agent_runs` | Existing row with `id`, `user_id`, `status`, timestamps, and search fields. Each research request creates one row and reaches `completed` or `failed` | One profile owns many runs |
| `agent_logs` | Existing row with `run_id`, `user_id`, optional `job_id`, safe message, and level | Many logs belong to one run and may reference one job |

No migration, new table, unique research key, retention policy, or schema change is required.

**State transitions**:

An agent run moves from `running` to `completed` after the dossier is saved, or from `running` to `failed` after an unrecoverable error. A job moves from no dossier to dossier saved, or from an existing dossier to a new dossier only after a successful refresh. Failed refreshes preserve the existing dossier.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/agent/research` | POST | `jobId: string` required, `force: boolean` optional and false by default | `success`, `data.dossier`, `data.jobId`, `data.refreshed` | Authenticated owner | 400 malformed input, 401 unauthenticated, 404 not found or not owned, 409 active request, 422 missing profile, 502 provider failure, 500 unexpected failure |

The route always returns the project wrapper `{ success, data?, error? }` and never exposes provider or model errors.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Start research | Authenticated user ID | InsForge server auth session |
| Load job | Job title, company, description, matched skills, missing skills, Adzuna redirect | Owner scoped `jobs` row |
| Load candidate context | Current title, experience, skills, and work history | Owner scoped `profiles` row |
| Resolve homepage | Employer root URL | Followed job redirect URL, then company name fallback |
| Browse company | One liner, product summary, signals, and internal links | Stagehand extraction from employer pages |
| Synthesize dossier | All nine dossier fields | GPT 4o using browser data, job row, and profile row |
| Save dossier | Persisted JSON object | Validated synthesis result and owner scoped job update |
| Render details | Company briefing sections and sources | Saved `company_research` object |
| Emit analytics | `userId`, `jobId`, and company | Auth session, request job ID, and saved job company |

**Key invariants**:

* Every database query is scoped to the authenticated `user_id`.
* Every research request creates exactly one agent run.
* Agent runs end in the existing database controlled terminal state.
* `company_research` is updated only with the validated complete schema.
* A failed refresh never clears or partially replaces the prior dossier.
* Browser research uses one session, at most three sub pages, and always closes the session.
* The browser never fetches the job description or profile. Those values come from InsForge.
* GPT 4o synthesis uses temperature `0.4` and JSON response mode.
* Unsupported company claims are not invented when browser research is empty.

**Security model**:

The route is private and requires a valid InsForge session. The job ID is an opaque lookup input, not an authorization grant. The server loads the job and profile only through owner scoped queries, and an absent or non owned job returns the same safe not found response. Browserbase and OpenAI credentials remain server side. Research data is public company information combined with private profile and job data, so prompts, profile values, model output, and scraped content must not enter logs or client errors.

**Configuration required**:

No new variables. Use the existing `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, and `OPENAI_API_KEY` settings.

**Critical test scenarios**:

* Happy path: an authenticated owner researches a saved job, receives the dossier, sees it on the details page, gets one completed run, and emits `company_researched`, verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-7**, and **AC-10**.
* Fallback: the employer URL is invalid or empty, browser research yields no meaningful content, and synthesis still returns a grounded dossier, verifies **AC-5**.
* Refresh failure: an existing dossier remains unchanged after a provider timeout, verifies **AC-4** and **AC-9**.
* Existing state: a saved dossier renders without a new request until refresh is explicitly selected, verifies **AC-6**.
* Concurrency: a second request for the same job receives 409 and cannot replace the first result, verifies **AC-9**.
* Auth and ownership: signed out and cross owner requests receive safe denial responses, verifies **AC-8**.
* Validation: malformed input and invalid model JSON are rejected without a database write, verifies **AC-3** and **AC-9**.

## Build plan

The project has no recorded delivery approach, so this plan assumes Tracer Bullet. It starts with one complete server to database thread, then adds the browser and synthesis depth, then wires the existing details UI and hardens failure behavior.

1. [x] Add typed research and dossier schemas, agent run and safe log helpers, and owner scoped reads, satisfying **AC-2**, **AC-3**, and **AC-8**.
2. [x] Implement the smallest end to end `POST /api/agent/research` path with one agent run, profile and job reads, deterministic fallback synthesis boundary, validated JSON persistence, terminal run update, and safe response, satisfying **AC-1**, **AC-2**, **AC-3**, **AC-4**, and **AC-5**.
3. [x] Add homepage derivation, one Browserbase session, Stagehand homepage extraction, prioritized internal page visits capped at three, and guaranteed cleanup, satisfying **AC-1**, **AC-5**, and **AC-9**.
4. [x] Add GPT 4o synthesis grounded in the three data sources, strict validation, atomic update behavior, refresh handling, and same job concurrency protection, satisfying **AC-3**, **AC-4**, **AC-6**, and **AC-9**.
5. [x] Replace the job details empty state with the dossier view, refresh action, accessible loading and error states, and `company_researched` capture after save, satisfying **AC-6**, **AC-7**, and **AC-10**.
6. [x] Run lint, strict TypeScript, and production build. The authenticated `/check verify` journey remains for the next verification pass, satisfying **AC-1** through **AC-10**.

## Consequences

**Positive**:

* The user gets a specific company and interview briefing in the existing job details flow.
* Existing database tables, providers, authentication, and analytics are reused.
* Failed refreshes are recoverable because the prior dossier remains available.
* Run and log records make provider failures diagnosable without exposing private content.

**Negative / tradeoffs**:

* The browser and model work occupy one synchronous request for up to two minutes.
* The concurrency guard must work across the deployed request environment, not only in one process.
* Company name URL fallback can select the wrong domain, so synthesis must remain grounded and cautious.

**Neutral**:

* No migration is needed, but the application schema validator becomes the authority for the JSON object shape.
* Research cost and latency are paid only when the user explicitly requests or refreshes it.

## Follow-up

* [ ] Confirm the deployed Next.js runtime supports the required synchronous route duration and Browserbase session behavior before production rollout.
* [ ] Revisit the database read failure retry scenario deferred by Feature 11 before final phase acceptance.

## References

**Project sources**:

* `context/library-docs.md`, Company Research Pattern, Browserbase, Stagehand, OpenAI, and InsForge rules
* `context/architecture.md`, data boundaries and request flow
* `context/build-plan.md`, Feature 13 design seed
* `context/code-standards.md`, route, agent, logging, and analytics conventions
* `docs/specs/0002-job-data-foundation/index.md`, existing jobs, agent runs, agent logs, and row ownership contract
* `agent/AGENTS.md`, server side AI privacy and validation boundary

**Practices and standards**:

* Owner scoped authorization for every data query
* Validate external model output at the application boundary
* Preserve last known good state on refresh failure
* Close external browser sessions in a `finally` block
