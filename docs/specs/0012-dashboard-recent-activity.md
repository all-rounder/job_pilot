# 0012. Dashboard recent activity

**Date**: 2026-07-22
**Status**: In Progress

## Summary

Feature 16 replaces the dashboard's local activity examples with the five newest completed activities for the signed in user. It combines completed job searches and completed company research from the existing InsForge records. The existing dashboard component contract remains in place, so this is a focused server data change with no migration or new endpoint.

## Context

The dashboard currently renders activity from `lib/dashboard-placeholder.ts`. The database already records job discovery runs in `agent_runs`, successful research actions in `agent_logs`, and the related jobs in `jobs`. The dashboard needs to show useful personal history without introducing another activity store.

Only completed work belongs in this view. Failed and running operations should not appear as user accomplishments. Research completion time is available through the related run, while the successful log identifies the researched job and its company.

## Requirements

**User stories**:

* As a signed in job seeker, I want to see my five newest completed searches and company research actions so that I can understand what I have done recently.

**Acceptance criteria**:

* **AC-1**: An authenticated dashboard displays at most five activity items, ordered from newest to oldest.
* **AC-2**: Completed job searches appear with the job count and searched title, using the existing search activity presentation.
* **AC-3**: Completed company research appears with the company name from the related owner scoped job record.
* **AC-4**: Failed and running agent operations do not appear in Recent Activity.
* **AC-5**: Search and research items use relative time based on the completed run timestamp.
* **AC-6**: A user with no completed activity sees the existing concise empty state and no placeholder activity.
* **AC-7**: Database read failures do not expose internal details or break the dashboard. The server logs the failure and the activity section shows the safe empty state.
* **AC-8**: All activity reads are scoped to the authenticated user, and a signed out request remains protected by the existing dashboard route boundary.
* **AC-9**: Existing dashboard layout, stat cards, chart areas, responsive behavior, and accessibility remain unchanged.

## Options considered

### Option 1: Reuse existing activity records

Read completed `agent_runs`, successful research `agent_logs`, and related `jobs`, then merge them into the existing `ActivityItem` view model.

**Pros**:

* No migration or new persistence path.
* Uses timestamps and ownership rules already present in the schema.
* Keeps the feature aligned with the current dashboard design.

**Cons**:

* The server performs more than one read and merges the results in memory.
* Research activity needs a second lookup to resolve the company name.

### Option 2: Add a dedicated activity table

Create one normalized activity row for every completed user action and read that table for the dashboard.

**Pros**:

* The dashboard query becomes direct and uniform.
* Future activity types could share one storage contract.

**Cons**:

* Every producer needs new write logic and failure handling.
* A migration and retention policy are required for data that already exists in other tables.
* Historical activity would be incomplete unless backfilled.

### Option 3: Read activity from PostHog

Use existing analytics events as the dashboard activity source.

**Pros**:

* No database migration.
* Analytics already contains search and research events.

**Cons**:

* Analytics delivery is not the product record of completion.
* Event querying adds external latency and failure modes.
* Search descriptions and job counts are not fully represented in the event contract.

## Decision

**Chosen option**: Option 1, reuse existing activity records.

The protected dashboard server route will call a new owner scoped helper in `lib/dashboard-activity.ts`. The helper will read completed search runs and successful research logs with their related job identifiers, resolve the related jobs, map both sources to `ActivityItem`, sort by completion time, and return the five newest items. The existing `DashboardPage` will receive the live list instead of importing placeholder activity.

## Rationale

The current schema already has the required facts, including user ownership, run state, completion timestamps, job counts, and research job identifiers. A dedicated table would duplicate this information and require every agent path to maintain another record. PostHog is useful for charts, but it is not reliable enough to be the source of user facing completion history.

The implementation accepts a small amount of server side merging because the feature volume is limited to five displayed items and the existing indexes support user scoped reads. This keeps the change reversible and avoids new infrastructure.

## Feature design

**Data model sketch**:

No new entity, field, relationship, migration, or index is introduced.

| Entity | Fields used | Relationship |
|---|---|---|
| `agent_runs` | `id`, `user_id`, `status`, `job_title_searched`, `jobs_found`, `completed_at` | Owned by the authenticated user |
| `agent_logs` | `run_id`, `user_id`, `level`, `job_id`, `created_at` | Belongs to an `agent_runs` row and may reference a `jobs` row |
| `jobs` | `id`, `user_id`, `company` | Owned by the authenticated user and linked from a research log |

The existing `ActivityItem` type remains the output model. Its `kind` is `match` for completed job searches and `research` for completed company research. Its existing `id`, `description`, and `relativeTime` fields remain unchanged.

**State transitions**:

No new state machine is introduced. Only `agent_runs.status = completed` is eligible. A research item is eligible only when its related run is completed and its related log has `level = success` and a non null `job_id`.

**API surface**:

No new public or private endpoint is introduced. The protected `/dashboard` server page calls `getDashboardActivity(database, userId)`.

| Operation | Method | Inputs | Output | Auth | Key errors |
|---|---|---|---|---|---|
| Read dashboard activity | Server function | `database`, authenticated `userId` | `ActivityItem[]`, maximum five items | Existing protected route and server client | Database failure returns an empty list and logs a scoped error |

**Value sourcing**:

| Displayed value | Source |
|---|---|
| Search description | `agent_runs.jobs_found` and `agent_runs.job_title_searched` |
| Research description | `jobs.company` from the job referenced by a successful `agent_logs.job_id` |
| Search completion time | `agent_runs.completed_at` |
| Research completion time | `agent_runs.completed_at` for the run referenced by `agent_logs.run_id` |
| Activity kind | Derived from source query, `match` for search and `research` for company research |
| Activity ID | Stable source identifier, prefixed by source type when needed |
| Relative time text | Derived from the completion timestamp using the existing dashboard time formatting convention |
| Display limit | Fixed decision in this spec, five items |
| Empty state | Existing `ActivityList` empty state in `DashboardPage` |

**Key invariants**:

* Every query filters by the authenticated `user_id`.
* Only completed runs can produce activity.
* Only successful research logs with a related job can produce research activity.
* Invalid or missing timestamps are ignored rather than displayed as misleading dates.
* The returned list is sorted by completion time descending and limited to five after merging.
* Placeholder activity is never shown when live activity is empty.
* Database errors are logged with the `[dashboard-activity]` context and return an empty list.
* No raw database error is returned to the browser.

**Security model**:

The dashboard remains protected by the existing authentication boundary. The server resolves the current user from the existing InsForge session and reads only rows owned by that user. No browser client query, public endpoint, cross user lookup, or new permission model is allowed.

**Configuration required**:

None. Existing InsForge configuration is used.

**Critical test scenarios**:

* Authenticated user with completed searches and research sees the five newest merged items, verifying **AC-1**, **AC-2**, **AC-3**, and **AC-5**.
* Failed and running runs, plus unsuccessful research logs, are excluded, verifying **AC-4**.
* User with no eligible rows sees the empty state and no placeholder values, verifying **AC-6**.
* Forced database read failure produces the safe empty state and a `[dashboard-activity]` server log, verifying **AC-7**.
* Signed out access remains denied and one user cannot see another user's activity, verifying **AC-8**.
* Existing dashboard stats, charts, navigation, responsive layout, focus behavior, and accessible headings remain intact, verifying **AC-9**.

## Build plan

The project uses a facade approach. For this enhancement, the existing facade is preserved while its activity source is replaced in one thin server rendered slice.

1. Add `lib/dashboard-activity.ts` with typed owner scoped reads, source mapping, relative time formatting, merge sorting, five item limiting, and safe failure handling, satisfying **AC-1** through **AC-8**.
2. Replace the dashboard placeholder activity import with the helper result and pass the list through the existing `DashboardPage` props, satisfying **AC-1**, **AC-6**, **AC-8**, and **AC-9**.
3. Remove only the obsolete placeholder activity export after the live path is wired, preserving placeholder chart data for Feature 17, satisfying **AC-6** and **AC-9**.
4. Run lint, strict TypeScript, production build, authenticated runtime verification, empty state verification, and failure path verification, satisfying **AC-1** through **AC-9**.

## Consequences

**Positive**:

* Recent Activity reflects real completed user work.
* No schema, endpoint, dependency, analytics event, or environment variable is added.
* The existing dashboard UI and accessibility contract remain stable.

**Negative / tradeoffs**:

* Activity is merged in server memory from multiple existing records.
* Research activity depends on the existing successful agent log and job link being present.
* A database failure looks like an empty activity section to the user, while the server log carries the diagnostic detail.

**Neutral**:

* Repeated completed research actions appear as separate activity items.
* The view shows five items rather than providing pagination or a full history page.

## Migration plan

**Strategy**: no migration needed

**Phases**:

1. Add the read helper and wire it into the existing protected server page.
2. Remove the activity placeholder export and verify the live, empty, error, and ownership paths.

**Rollback**: Revert the single implementation change and restore the existing placeholder activity import. No database rollback is required.

**Risks**: Existing historical research runs that lack a successful log or job identifier will not appear. This is intentional because the feature must show only activities whose completion and subject can be proven from the current records.

## Follow-up

* [ ] Consider a dedicated activity history surface if users need more than the five newest items.
* [ ] Revisit database side merging only after measured dashboard activity volume makes server side merging a problem.
