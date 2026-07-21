**Status**: In Progress

## Summary

Feature 14 replaces the dashboard placeholder with the complete authenticated dashboard surface. It gives a job seeker an immediate overview of saved jobs, match quality, company research, recent activity, and chart areas using typed local mock data.

The page follows `context/designs/dashboard.png` and existing JobPilot tokens. Real database and PostHog values remain outside this feature and are delivered by Features 15 through 17.

## Context

The protected dashboard currently proves authentication but does not help a signed in job seeker understand their job search progress. The supplied dashboard design defines the visual composition, while the build plan separates the UI facade from later real data slices.

## Options considered

### UI facade with typed mock data

Build every dashboard section and responsive state first, with mock values kept in typed module data. This makes the page visible and testable without coupling the UI to unfinished data queries.

### Build the dashboard directly against live data

Wire all metrics, activity, and charts during the first dashboard pass. This gives earlier real output but combines four feature scopes and makes visual verification depend on database state.

### Static screenshot replica

Match the supplied image with mostly fixed markup. This is fast, but it does not provide reusable data driven components or accessible empty states for later wiring.

## Decision

Build a responsive authenticated dashboard facade with typed mock data. Reuse the existing navigation, auth, token, card, typography, and accessibility patterns. Render charts with CSS and inline SVG primitives owned by the page, with no new chart dependency in this feature. Keep each section data driven so Features 15 through 17 can replace the mock sources without changing the page contract.

The dashboard contains a top navigation bar, four stat cards, a recent activity card, a company research activity chart, a jobs found over time chart, and a match score distribution chart. Every chart and activity section has a meaningful empty state path even though the initial mock state is populated.

## Requirements

* **AC-1**: An authenticated user visiting `/dashboard` sees the complete dashboard facade without the authentication placeholder copy.
* **AC-2**: The page renders four stat cards for total jobs found, average match rate, companies researched, and jobs this week with typed mock values and the visual treatment from the dashboard design.
* **AC-3**: The page renders recent activity entries with activity type indicators, readable descriptions, and relative time labels from typed data.
* **AC-4**: The page renders jobs found over time, company research activity, and match score distribution chart areas with visible labels, axes, values, and token based colors.
* **AC-5**: The dashboard is responsive at desktop and narrow mobile widths without horizontal page overflow or inaccessible clipped content.
* **AC-6**: The dashboard uses the existing top navigation with Dashboard active and working links to `/dashboard`, `/find-jobs`, and `/profile`, plus the existing sign out action.
* **AC-7**: Sections that receive no data render a concise empty state rather than broken chart markup, undefined text, or an exception.
* **AC-8**: Interactive elements have accessible names, visible keyboard focus, semantic headings, and sufficient text alternatives for chart summaries.

## Feature design

**Data model**:

No database model or migration is introduced. The facade uses typed local view models:

| View model | Fields | Source in this feature |
|---|---|---|
| `DashboardStat` | `label`, `value`, optional `trend`, `subtitle` | Typed mock module data |
| `ActivityItem` | `id`, `kind`, `description`, `relativeTime` | Typed mock module data |
| `ChartSeries` | `label`, `value` or point values, optional `summary` | Typed mock module data |

Features 15 through 17 replace these mock sources with owner scoped InsForge and PostHog reads. No browser storage, client persistence, or new server endpoint is allowed for Feature 14.

**Page composition**:

1. Shared authenticated top navigation with Dashboard active.
2. Four stat cards in a responsive grid.
3. Two column middle row with Recent Activity and Company Research Activity.
4. Two column lower row with Jobs Found Over Time and Match Score Distribution.
5. Empty states inside any section whose data array is empty.

**State behavior**:

The server page renders the populated mock state. Data driven child components also handle empty arrays. There is no loading, mutation, polling, or error state in this UI only slice.

**Value sourcing**:

| Display or action | Source |
|---|---|
| Current user greeting, when shown | Existing authenticated user profile or email read |
| Stat values and trends | Typed local mock data |
| Activity descriptions and times | Typed local mock data |
| Chart labels and values | Typed local mock data |
| Navigation destinations | Fixed existing routes |
| Sign out behavior | Existing `signOut` action and `SignOutButton` |
| Empty state text | Component constants based on the empty series or list |
| Chart text alternatives | Series `summary` values plus visible labels |

**Security model**:

The page remains under the existing protected route boundary. The server obtains only the current authenticated user needed for the greeting. Mock dashboard values are clearly temporary implementation data and must not be presented as persisted personal analytics outside this development slice.

**Accessibility and responsive behavior**:

Use semantic `main`, headings, lists, links, buttons, and navigation landmarks. Charts include a concise accessible summary and visible labels. Cards stack into one column on narrow screens, and chart containers use contained overflow without causing page level horizontal scrolling. All focusable controls use the existing accent focus ring pattern.

**Critical test scenarios**:

* Authenticated dashboard load with populated mock data verifies AC-1 through AC-4 and AC-6.
* Narrow viewport inspection verifies AC-5.
* Empty activity and empty chart series fixture verifies AC-7.
* Keyboard tab order, focus visibility, headings, link names, and chart summaries verify AC-8.

## Build plan

The project uses a facade approach for this feature. Build the visual shell first, then make each section typed and data driven, then verify responsive and accessible states.

1. [x] Replace the dashboard placeholder with the shared authenticated layout and responsive card grid, satisfying AC-1, AC-5, and AC-6.
2. [x] Add typed mock stat and activity data with reusable stat and activity components, satisfying AC-2 and AC-3.
3. [x] Add token based inline SVG and CSS chart components with visible labels and summaries, satisfying AC-4 and AC-8.
4. [x] Add empty state branches and complete responsive and keyboard verification, satisfying AC-5, AC-7, and AC-8.
5. [x] Run lint, strict TypeScript, and production build for the dashboard facade.

## Consequences

**Positive**:

* The dashboard becomes a complete, navigable product surface before analytics data is available.
* Typed view models give later data features a stable rendering contract.
* Inline chart primitives avoid adding a dependency before real chart requirements are implemented.

**Negative / tradeoffs**:

* The displayed values are not real user analytics until Features 15 through 17 are built.
* Inline chart primitives require later care when real series and interaction needs expand.

**Neutral**:

* No migration, API route, or new environment variable is required.
* The existing authentication boundary and sign out action remain unchanged.

## Follow-up

* Feature 15 replaces stat mock data with owner scoped InsForge aggregates.
* Feature 16 replaces activity mock data with merged owner scoped activity records.
* Feature 17 replaces chart mock data with PostHog series and the final chart implementation.

## References

* `context/designs/dashboard.png`, dashboard visual source
* `context/ui-tokens.md`, JobPilot token and component rules
* `context/ui-rules.md`, layout, accessibility, and responsive rules
* `context/build-plan.md`, Features 14 through 17
* `app/(protected)/dashboard/page.tsx`, existing authenticated dashboard boundary
