# 0008. Database backed job listing

**Date**: 2026-07-21
**Status**: Accepted

## Summary

Feature 11 replaces the temporary in memory job list with owner scoped reads from InsForge. The first page is rendered on the server, and later changes use a small authenticated read endpoint. Filters, sorting, and pagination are stored in the URL so refresh and browser navigation preserve the listing.

## Context

Feature 09 created the Find Jobs page with local mock data and six row pages. Feature 10 connected search submission to Adzuna and returned the current run directly to the page. That approach is useful for the search journey, but it cannot show all saved jobs, preserve listing state across navigation, or page through data that was found in earlier searches.

The existing `jobs` table already has owner keys, match fields, and indexes for the common listing orders. The feature needs no new entity or migration. The page is an authenticated surface and must keep the current user boundary in both application queries and database row level security.

> Premise note: An eight row page is intentionally smaller than the eventual product target of twenty rows. It is a temporary testing choice for the current data volume. The page size is isolated in the API response and can be changed later without changing the URL contract.

## Requirements

**User stories**:

* As a signed in user, I want to see all of my saved jobs so that jobs from earlier searches remain available.
* As a signed in user, I want to filter and sort my jobs so that I can focus on useful matches.
* As a signed in user, I want the current listing state in the URL so that refresh and browser navigation preserve my place.

**Acceptance criteria**:

* **AC-1**: An authenticated visit to `/find-jobs` loads the first page from the current user's `jobs` rows, with no mock jobs used for the database listing.
* **AC-2**: `GET /api/jobs` accepts optional `q`, `match`, `sort`, and `page` parameters and returns an authenticated user's owner scoped jobs with `total`, `page`, `pageSize`, and `pageCount` metadata.
* **AC-3**: Text search matches `company` or `title` case insensitively, using `q` after trimming it.
* **AC-4**: The match filter supports `all`, `high` for `match_score >= 70`, and `low` for `match_score < 70`.
* **AC-5**: Sorting supports `score` descending by `match_score`, `newest` descending by `found_at`, and `oldest` ascending by `found_at`.
* **AC-6**: Pagination returns eight rows per page, uses page one by default, reports the correct total and page count, and safely handles invalid or out of range page values.
* **AC-7**: Changing text search, match filter, or sort updates the URL and resets the page to one. Changing page updates only the page parameter. Browser refresh and back or forward navigation restore the corresponding listing state.
* **AC-8**: The page shows loading feedback while a changed listing is loading, a clear empty state when no rows match, and a retryable safe error state when the database read fails. Existing filter values remain visible after an error.
* **AC-9**: Signed out page and API access is denied by the existing protected route and server authentication checks. A request cannot select another user's rows through query parameters.
* **AC-10**: The implementation passes lint, strict TypeScript, production build, and the required runtime verification for the listing flow.

## Options considered

### Option 1: Server page plus authenticated read endpoint

Render the first page on the server and use `GET /api/jobs` for client state changes.

**Pros**:

* Reuses the current Next.js and InsForge server patterns.
* Gives the first view real data without a client loading flash.
* Keeps authorization and query rules on the server.

**Cons**:

* The page needs a small client boundary for URL changes and loading feedback.

### Option 2: Fetch every job in the browser

Load all owner jobs once, then filter, sort, and paginate locally.

**Pros**:

* Fewer requests after the first load.

**Cons**:

* Sends an unbounded list to the browser.
* Becomes slow and stale as the user's saved jobs grow.
* Moves database query behavior into client code.

### Option 3: Server action for every listing change

Use a server action instead of a route handler for client listing changes.

**Pros**:

* Fits the framework's server mutation pattern.

**Cons**:

* A read endpoint maps more directly to URL driven list state.
* It is less convenient to inspect and verify independently.

## Decision

**Chosen option**: Option 1: Server page plus authenticated read endpoint

Use the existing server page to load the first page and add `GET /api/jobs` for URL driven listing reads. Use the URL as the canonical state with `q`, `match`, `sort`, and `page`. Use eight rows per page for the current testing phase.

**Implementation skills**: `develop` (`E:/GitHub/job_pilot/.agents/skills/develop/`), `check` (`E:/GitHub/job_pilot/.agents/skills/check/`)

## Rationale

This option keeps the initial view fast and keeps all database access behind the existing server authentication and row level security model. The API is small enough to maintain, while URL state makes the list reproducible and compatible with browser navigation. Fetching every job in the browser would work for the current data volume but creates an avoidable security, freshness, and scaling problem.

## Feature design

**Data model sketch**:

| Entity | Fields and rules | Relationships |
|---|---|---|
| `jobs` | Existing `id`, `user_id`, `title`, `company`, `salary`, `match_score`, `found_at`, `source`, `source_url`, `external_apply_url`, and fields required by the current table. No fields are added. | Many jobs belong to one authenticated user through `user_id`. |
| `profiles` | Existing owner row used by the authentication relationship. No profile fields are read for listing. | One owner has many jobs. |

The existing indexes on `(user_id, found_at desc)` and `(user_id, match_score desc)` support the primary sort paths. No migration is required.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/jobs` | GET | `q:string` optional, `match:all\|high\|low` optional, `sort:score\|newest\|oldest` optional, `page:positive integer` optional | `success`, `data.jobs`, `data.total`, `data.page`, `data.pageSize`, `data.pageCount` | Current InsForge user required | `401` signed out, `500` safe database error |

Successful responses use this shape:

```json
{
  "success": true,
  "data": {
    "jobs": [],
    "total": 0,
    "page": 1,
    "pageSize": 8,
    "pageCount": 0
  }
}
```

Database query failures use this safe shape:

```json
{
  "success": false,
  "error": "We could not load your jobs. Please try again."
}
```

Invalid query values use defaults. Page values below one use page one. Page values beyond the final page return the final page when jobs exist, or page one when the result is empty.

**URL state**:

```text
/find-jobs?q=engineer&match=high&sort=score&page=1
```

The default URL omits default values. The page resets to one when `q`, `match`, or `sort` changes. Browser back and forward restore the full query state.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Resolve owner | Current user ID | InsForge authenticated server session |
| Normalize listing state | `q`, `match`, `sort`, `page` | URL query parameters and specified defaults |
| Filter text | Matching company or title rows | `jobs.company` and `jobs.title` |
| Filter score | High or low match rows | `jobs.match_score` and the fixed threshold `70` |
| Sort rows | Ordered result set | `jobs.match_score` or `jobs.found_at`, selected by `sort` |
| Page size | Eight | This decision |
| Total count | Number of rows after owner, text, and match filters | InsForge filtered count |
| Page count | Number of pages | Derived from `total` and page size `8` |
| Result rows | Table data | Current user's selected `jobs` rows |
| Loading state | Loading message | Client request lifecycle |
| Empty state | No matching jobs message | Filtered response with zero rows |
| Error state | Safe retry message | API response or request failure |

**Key invariants**:

* Every jobs query includes the authenticated `user_id` filter.
* Query parameters never provide or override the owner identity.
* The server owns filter, sort, count, and pagination behavior.
* Results are ordered deterministically, using `id` as a stable tie breaker after the selected primary order.
* The response never returns jobs outside the current user's row level security scope.
* Page size remains eight for this feature and is returned in the response metadata.
* The API does not expose database error details to the browser.

**Security model**:

Only an authenticated InsForge user may read jobs. The page and route handler resolve the user from the server session. The browser may provide only listing controls. InsForge row level security remains the defense in depth boundary, and application queries also filter by `user_id`. This feature reads personal employment data but introduces no new regulated compliance scope.

**Configuration required**:

None.

**Critical test scenarios**:

* Happy path: an authenticated user loads the page and receives the first eight owner jobs with correct count metadata, verifies **AC-1**, **AC-2**, and **AC-6**.
* Text and match filters: company or title search and score threshold return only matching rows, verifies **AC-3** and **AC-4**.
* Sort and pagination: all three sort modes and page navigation produce the expected order and eight row pages, verifies **AC-5** and **AC-6**.
* URL navigation: changing controls updates query state, resets page when required, and browser back or forward restores it, verifies **AC-7**.
* Empty and failure states: no matching rows show the empty state, and a failed read shows safe retry feedback while preserving controls, verifies **AC-8**.
* Auth and ownership: signed out access returns `401` or redirects to login, and user supplied parameters cannot read another user's rows, verifies **AC-9**.
* Quality gates: lint, strict TypeScript, production build, and runtime verification pass, verifies **AC-10**.

## Build plan

The project uses a facade approach. Feature 09 already provides the UI shell and Feature 10 provides the search journey. This feature first adds the real owner scoped read path, then replaces the local listing state while preserving the existing visual surface.

1. Add a shared listing query normalizer and typed response shape for the four URL parameters, defaults, page bounds, threshold, and eight row page size, satisfying **AC-2**, **AC-4**, **AC-6**, and **AC-7**.
2. Add authenticated owner scoped `GET /api/jobs` reads with filtered counts, deterministic sorting, pagination metadata, safe errors, and stable row mapping, satisfying **AC-2** through **AC-6** and **AC-9**.
3. Load the first listing page from the protected server route and replace mock rows with the real response while preserving the existing search controls and table fields, satisfying **AC-1** and **AC-2**.
4. Wire URL driven filter, sort, page changes, loading, empty, error, retry, and browser navigation behavior into the Find Jobs client surface, satisfying **AC-3** through **AC-8**.
5. Update the UI registry and progress tracker, then run lint, strict TypeScript, production build, and runtime verification, satisfying **AC-10**.

## Consequences

**Positive**:

* Earlier search results remain available through one real listing.
* Query rules are centralized on the server and protected by ownership checks.
* URL state makes filtering and pagination restorable and verifiable.
* No migration or new dependency is needed.

**Negative and tradeoffs**:

* Filter and page changes make a network request.
* The page size is eight for testing and may need a later product decision.
* The current client component must coordinate URL state with server responses.

**Neutral**:

* Feature 10 search response behavior remains available for the search success message, but the listing itself becomes database backed.
* Existing jobs with null match scores remain visible in `all`, sort last in score order, and are excluded from `high` and `low` filters unless the query explicitly matches their score rule.

## Follow-up

* [ ] Revisit the eight row page size when the product has enough persisted jobs for realistic pagination testing.
* [ ] Complete the deferred Feature 10 provider failure and partial scoring runtime scenarios before final phase acceptance.

## References

**Project sources**:

* `AGENTS.md`, project rules and quality gates
* `context/build-plan.md`, Feature 11 requirements
* `context/library-docs.md`, InsForge query and ownership rules
* `docs/specs/0002-job-data-foundation/index.md`, jobs schema and access control
* `docs/specs/0006-find-jobs-ui.md`, existing Find Jobs visual and interaction surface
* `docs/specs/0007-adzuna-job-discovery.md`, Feature 10 response and follow up contract

**Practices and standards**:

* Owner scoped queries and defense in depth row level security
* REST read endpoint for a standard paged resource
* Stable deterministic ordering for paginated data

## Migration plan

**Strategy**: no migration needed

**Phases**:

1. Add the read path alongside the existing search response.
2. Switch the table listing to the read path and retain the existing search form.

**Rollback**: Revert the page and client wiring to the Feature 10 returned job list. The API route can remain unused because it creates no data changes.

**Risks**: The API and server page could temporarily disagree about URL normalization. Shared normalizer logic and runtime verification must cover both paths.
