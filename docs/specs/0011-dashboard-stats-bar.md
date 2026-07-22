# 0011 Dashboard Stats Bar

**Status**: Accepted
**Date**: 2026-07-22
**Authorized by**: engineer, during /architect ratification

## Summary

Feature 15 connects the dashboard stat cards to the signed in user's saved jobs. The server reads the user's job data, summarizes four values, and passes them to the existing dashboard cards. This keeps the feature small and uses the data and server patterns already established in the project.

## Context

The dashboard initially used local placeholder values. The project already stores job scores, research dossiers, and discovery timestamps in the `jobs` table. The dashboard is protected by the existing InsForge session boundary, so the signed in user is available while the page renders.

The feature needs four values, total jobs, average match rate, researched companies, and jobs found during the last seven days. No new table, migration, endpoint, provider, or client state is required.

## Requirements

**User stories**:

* As a signed in job seeker, I want the dashboard stats to reflect my saved jobs so that I can understand my current search progress.

**Acceptance criteria**:

* **AC-1**: The authenticated dashboard displays four stat cards using data scoped to the current user.
* **AC-2**: Total Jobs Found equals the number of current user rows in `jobs`.
* **AC-3**: Avg. Match Rate equals the rounded average of non null `jobs.match_score` values, displayed as a percentage. If there are no scored jobs, it displays `0%`.
* **AC-4**: Companies Researched equals the number of current user rows whose `jobs.company_research` is not null.
* **AC-5**: Jobs This Week equals the number of current user rows whose `jobs.found_at` is within the previous seven days.
* **AC-6**: A database read failure does not expose internal details or break the dashboard. The stat cards display safe zero values and the server logs the scoped failure.
* **AC-7**: The implementation preserves the existing dashboard card layout and uses the existing protected server page and InsForge client conventions.

## Options considered

### Option 1: Summarize the user's job rows in the protected dashboard server page

Read the required job fields through the existing server client, derive the four values in `lib/dashboard-stats.ts`, and pass the existing `DashboardStat` view model to the dashboard.

**Pros**:

* Smallest change for a four value dashboard feature.
* Reuses the existing authentication, server component, database, and card patterns.
* No new API surface or client data fetching.

**Cons**:

* The selected rows are summarized in server memory.
* Very large job histories may eventually need database side aggregation.

### Option 2: Use database side aggregate queries

Run count and average operations in the database, possibly through several queries or a database function.

**Pros**:

* Less row data is transferred and held in server memory.
* Aggregation can scale better for very large histories.

**Cons**:

* Adds query complexity or a database function for a small feature.
* Several aggregate queries need coordinated error handling.
* It does not match the current simple InsForge query patterns.

### Option 3: Add a dashboard stats API route

Create a protected endpoint that computes the four values and have a client component fetch the result.

**Pros**:

* Provides a reusable HTTP surface for future clients.
* Could support later refresh or polling behavior.

**Cons**:

* Adds an endpoint and client loading and error states without a current product need.
* Introduces another authorization boundary for the same page.
* Adds browser JavaScript and request latency to a server rendered page.

## Decision

**Chosen option**: Option 1, summarize the user's job rows in the protected dashboard server page.

The dashboard reads `match_score`, `company_research`, and `found_at` from current user rows in InsForge, derives the four stat values in a server helper, and passes them to the existing dashboard component. This is the appropriate scale and complexity for Feature 15. The alternative database aggregate approach remains a future optimization if measured job history volume makes it necessary.

## Rationale

The feature is intentionally simple, and the project already has a protected server page, an InsForge server client, an owner scoped query convention, and a typed dashboard stat view model. Reusing those pieces minimizes new failure modes and keeps the values out of the browser until they are rendered.

The implementation accepts the cost of server side row summarization because no performance problem has been measured and the current requirement is only four values. Database side aggregation is the runner up for future scale, but adding it now would create more moving parts than the feature needs.

## Feature design

**Data model sketch**:

No new data model is introduced. The existing `jobs` table is read by `user_id`.

| Field | Type | Use |
|---|---|---|
| `user_id` | UUID | Owner scope from the authenticated InsForge user |
| `match_score` | integer or null | Average of non null scores |
| `company_research` | JSON object or null | Research count when not null |
| `found_at` | timestamp | Seven day count |

**API surface**:

No new endpoint. The protected `/dashboard` server page calls `getDashboardStats` with the authenticated database client and user ID.

**Value sourcing**:

| Displayed value | Source |
|---|---|
| Total Jobs Found | Count of rows from `jobs` filtered by authenticated `user_id` |
| Avg. Match Rate | Rounded average of non null `jobs.match_score` values |
| Companies Researched | Count of rows with non null `jobs.company_research` after the same owner filter |
| Jobs This Week | Count of rows whose `jobs.found_at` is at least the current server time minus seven days |
| Empty or failed stat values | The decided safe zero fallback |
| Card labels and subtitles | Existing dashboard view model and Feature 15 copy |

**Key invariants**:

* Every database read is filtered by the authenticated `user_id`.
* Null match scores do not affect the average.
* A missing research dossier does not count as researched.
* Invalid timestamps do not count toward the seven day total.
* Database failures are logged with the `[dashboard-stats]` context and return safe zero values.

**Security model**:

The dashboard remains behind the existing authenticated route boundary. The server client reads only rows belonging to the current user. No stat endpoint is public, and no browser client directly queries InsForge for these values.

**Configuration required**:

None. Existing InsForge environment variables are used.

**Critical test scenarios**:

* Authenticated dashboard with saved jobs shows all four live values, verifies **AC-1** through **AC-5**.
* A user with no scored jobs shows `0%`, verifies **AC-3**.
* A database read failure produces safe zero cards and a scoped server log, verifies **AC-6**.
* A signed out request remains protected by the existing route boundary, verifies **AC-7**.
* Existing dashboard layout and browser rendering remain intact, verifies **AC-7**.

## Build plan

1. Add the owner scoped server helper that reads the required job fields and derives the four values, satisfying **AC-2** through **AC-6**.
2. Pass the live stat view model from the protected dashboard page into the existing dashboard component, satisfying **AC-1** and **AC-7**.
3. Run lint, strict TypeScript, production build, and authenticated runtime verification, satisfying **AC-1** through **AC-7**.

## Consequences

**Positive**:

* The dashboard now shows real personal search totals.
* The implementation has no migration, new endpoint, dependency, or client fetch.
* The existing card contract remains reusable for later dashboard features.

**Negative / tradeoffs**:

* The server reads matching job rows before summarizing them.
* The seven day boundary uses server time rather than a user specific timezone.
* Safe zero fallbacks can hide a temporary database outage from the user, while the server log preserves the failure signal.

**Neutral**:

* Features 16 and 17 can replace their own placeholder sources without changing this stat data path.

## Follow-up

* [ ] Revisit database side aggregation if measured job history size or dashboard latency requires it.
* [ ] Decide whether dashboard time windows should use a user profile timezone when time based dashboard features are expanded.

## References

**Project sources**:

* `context/build-plan.md`, Feature 15 requirements
* `context/library-docs.md`, InsForge server query and owner scoping conventions
* `context/code-standards.md`, server component and error handling conventions
* `docs/specs/0002-job-data-foundation`, existing jobs schema and row level security
* `docs/specs/0010-dashboard-page.md`, existing dashboard view model and layout contract

**Practices and standards**:

* Server side data fetching for protected pages
* Least privilege owner scoped data access
* Measure before optimizing
