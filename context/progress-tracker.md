# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 2, Profile Page
**Last completed:** 08 Resume PDF Generation from Profile
**In progress:** None
**Next:** 09 Find Jobs Page Full UI

---

## Progress

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

- [ ] 09 Find Jobs Page — Full UI
- [ ] 10 Adzuna Job Discovery
- [ ] 11 Filter + Sort + Pagination

### Phase 4 — Job Details Page

- [ ] 12 Job Details Page — Full UI
- [ ] 13 Company Research Agent

### Phase 5 — Dashboard

- [ ] 14 Dashboard Page — Full UI
- [ ] 15 Stats Bar — Real Data
- [ ] 16 Recent Activity — Real Data
- [ ] 17 Analytics Charts — PostHog Data

---

## Decisions Made During Build

- Feature 02 uses the official InsForge SSR flow: Server Action OAuth start, one server callback exchange, HTTP only refresh and PKCE cookies, `proxy.ts` refresh, and protected Server Component checks.
- Next.js 16 `proxy.ts` is an optimistic redirect and refresh layer, never the sole authorization boundary.
- Feature 03 uses Next.js client instrumentation plus one shared React provider. Protected routes identify the current InsForge user, and sign out resets browser identity before ending the session.
- Feature 04 uses one versioned PostgreSQL migration, forced row level security, and composite owner keys for relational data. Feature 06 owns authenticated resume access and PDF validation.
- Feature 06 uses one atomic owner scoped profile save function, derives completion from normalized profile values, records first completion once, and keeps one active private resume behind the authenticated `/api/resume` route.

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

_Add notes here as the build progresses — workarounds, patterns, anything that differs from the context files._
