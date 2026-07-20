**Status**: Proposed

## Summary

Feature 09 adds the protected Find Jobs page shown in `context/designs/find-jobs.png`. It is a responsive UI facade backed by typed mock jobs, with search controls, local filtering, sorting, and pagination. Real job discovery, persistence, and API calls remain in Feature 10.

## Context

This is a new feature in the existing Next.js 16 and React 19 application. The page is protected by the existing authenticated layout and must follow the project token system. The build plan names this feature as UI only with mock data.

## Requirements

- **AC-1**: Authenticated users can open `/find-jobs` and see the JobPilot header with Dashboard, Find Jobs, and Profile navigation, with Find Jobs marked active.
- **AC-2**: The page matches the supplied design with a search controls card, green success banner, filter toolbar, results table, and pagination card.
- **AC-3**: Search controls show Job Title and Location fields with the supplied placeholders and a Find Jobs button with a search icon.
- **AC-4**: The results table shows company, role, match score with a color coded progress bar, salary estimate, and date found for six visible mock jobs.
- **AC-5**: Filter text, match filter, match score sorting, and pagination update the visible mock results without a network request.
- **AC-6**: The surface is keyboard accessible, has visible focus states, labels all form controls, and remains usable on narrow screens.
- **AC-7**: The implementation passes lint, strict TypeScript, and production build.

## Decision

Use a server page for the protected route and a focused client component for the interactive mock list. Keep the mock data and display types in the client component until Feature 10 introduces the shared persisted job model. Use inline SVG icons already consistent with the profile surface, and use only existing CSS tokens and generated Tailwind utilities.

**Implementation skills**: `tailwind-css-patterns` (`E:/GitHub/job_pilot/.agents/skills/tailwind-css-patterns/`), `develop` (`E:/GitHub/job_pilot/.agents/skills/develop/`)

### Feature design

**Data flow**: The protected server page renders `FindJobsPage`. `FindJobsPage` owns local form state, derives filtered and sorted mock jobs, and renders six rows per page. No API, database query, or mutation is introduced.

**Visual rules**: Use `bg-background`, white token surfaces, `border-border`, `text-text-*`, `accent`, `success`, `info`, and `warning` tokens. The page max width is 1440px. Table rows use the existing token borders and responsive horizontal overflow.

**Interaction rules**: Text filtering matches company and role. The match filter supports All Matches, Strong Matches, and Other Matches. Sorting supports Match Score, Newest, and Oldest. Pagination shows six results per page and resets to page one when the filter or sort changes. Search submission preserves the facade and announces the mock result message.

**Security model**: Access is enforced by the existing protected route layout. No job data is read or written by this feature.

## Build plan

1. Add the protected `/find-jobs` server page and client UI facade, satisfying **AC-1**, **AC-2**, **AC-3**, and **AC-4**.
2. Add local filter, sort, search submission, and pagination behavior, satisfying **AC-5** and **AC-6**.
3. Update the UI registry and progress tracker, then run lint, TypeScript, and production build, satisfying **AC-7**.

## Consequences

**Positive**:

- The Find Jobs route becomes visually complete and testable before the discovery agent exists.
- The interactive state is isolated so Feature 10 can replace the data source without rebuilding the page shell.

**Negative / tradeoffs**:

- The success message and result rows are illustrative until Feature 10 connects real data.
- The first version adds client JavaScript for interactions that will later move toward server backed state.

## Follow-up

- [ ] Feature 10 should replace the mock data and success message with authenticated Adzuna discovery and persisted jobs.
- [ ] Feature 11 should decide whether filter, sort, and pagination move into URL search parameters for shareable state.

## Rationale

The supplied design and the project build plan both define a complete UI facade with mock data. A small client boundary is the simplest way to provide the required local interactions while preserving the server component default for the route.
