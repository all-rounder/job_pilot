# 0005. Resume PDF generation

**Date**: 2026-07-20
**Status**: Accepted

## Summary

Feature 08 generates a clean single page resume from the authenticated user's saved profile. GPT-4o polishes the summary and work history, `@react-pdf/renderer` creates the PDF in memory, and a unique private object becomes active only after upload and profile activation succeed.

## Context

The profile is now the durable source for candidate facts, while the active private PDF is the source used by later application workflows. Users need a professional document built from their reviewed profile without manually rewriting resume prose.

Generation touches personal information and replaces an existing private file. The server must therefore use only the current user's saved profile, keep model and PDF work in memory, validate the generated content and document, and avoid exposing a partial result.

## Requirements

**User stories**:

* As a signed in user with a complete saved profile, I want to generate a professional resume so that I have a current PDF ready for applications.
* As a user with an existing resume, I want a clear replacement warning so that I control when the generated document becomes active.

**Acceptance criteria**:

* **AC-1**: The profile page exposes Generate Resume when the saved profile is complete. An incomplete saved profile cannot start generation and is directed to complete and save the missing fields.
* **AC-2**: When an active resume exists, generation requires confirmation that the generated PDF will replace it. Cancelling changes nothing.
* **AC-3**: A confirmed authenticated request reads only the current user's saved profile. The browser cannot submit profile content, a user ID, or a storage key to the generation route.
* **AC-4**: GPT-4o returns strictly validated resume content containing a professional summary and polished responsibility bullets grounded only in saved profile facts. It must not invent employers, dates, qualifications, skills, or achievements.
* **AC-5**: The generated resume includes the user's name, contact links that are present, current title, summary, skills, up to three saved work roles, and education. Work authorization, job preferences, salary, and cover letter tone are excluded.
* **AC-6**: `@react-pdf/renderer` renders the validated content into a readable one page PDF with consistent typography, spacing, section hierarchy, and no clipped or overlapping content.
* **AC-7**: The server validates the rendered buffer as a nonempty one page PDF before storage. Invalid or multi page output is rejected without replacing the active resume.
* **AC-8**: A valid PDF is uploaded to the private `resumes` bucket at a unique `{user_id}/resume-{uuid}.pdf` key with `application/pdf`. `profiles.resume_pdf_url` is set to the exact owned key returned by storage, then the prior object is removed.
* **AC-9**: The successful response activates the existing View current PDF and extraction flows without a page reload.
* **AC-10**: The action exposes a loading state, prevents duplicate requests, and announces success or a safe human readable error.
* **AC-11**: Authentication, incomplete profile, OpenAI, validation, rendering, storage, and profile update failures do not expose personal data in logs or responses. A prior active resume remains usable unless the new upload and profile activation both complete successfully.

## Options considered

### Option 1: Structured content plus a deterministic server PDF template

GPT-4o produces bounded structured prose. A fixed React PDF template controls layout and the server stores the verified buffer.

**Pros**:

* Separates uncertain language generation from deterministic layout.
* Supports strict validation and a reliable one page contract.
* Reuses the current profile, private storage, and OpenAI conventions.

**Cons**:

* The fixed template offers limited visual customization.
* Content limits are required to protect the one page layout.

### Option 2: Ask GPT-4o to generate the whole document markup

The model returns layout markup or styling as well as resume text.

**Pros**:

* Allows more varied document designs.

**Cons**:

* Makes layout, security, and page count difficult to validate.
* Produces less repeatable documents from the same profile.

### Option 3: Render saved profile text without GPT-4o

The server maps saved values directly into the PDF template.

**Pros**:

* Lowest latency and no additional model cost.
* Fully deterministic content.

**Cons**:

* Does not provide the professional summary or polished responsibility language required by the feature.

## Decision

**Chosen option**: Option 1, structured content plus a deterministic server PDF template.

Use the existing OpenAI client and GPT-4o Structured Outputs for bounded resume prose. Use `@react-pdf/renderer` and `renderToBuffer()` in server only code. Cap generated sections before rendering, verify the PDF signature and page count, upload to a unique owner scoped key, activate the exact returned key, then remove the prior object.

**Implementation skills**: `openai-docs`, `pdf`

## Rationale

The model is useful for language but should not control document structure. A validated content contract prevents invented fields from entering the template, while a deterministic renderer gives the application direct control over typography, spacing, and page count. A unique private object key avoids provider rename collisions while the profile pointer preserves the one active resume model used by Features 06 and 07.

## Feature design

**Data model sketch**:

A compatibility migration permits both the earlier `{user_id}/resume.pdf` key and unique `{user_id}/resume-{uuid}.pdf` keys. New generation uses unique keys. Existing fixed keys remain valid owned resume objects until replaced or removed.

| Shape | Fields | Rules |
|---|---|---|
| Existing saved profile | Current personal, professional, work experience, education, and skills columns | Authenticated owner read, must satisfy the existing completion contract |
| Generated resume content | `summary`, up to three roles with `company`, `title`, dates, and bounded `bullets` | Strict Structured Output, profile facts only, temporary in memory |
| Generated PDF | Buffer rendered from saved facts plus validated content | `%PDF-` signature, nonempty, exactly one page, never written to local disk |
| Active resume | `profiles.resume_pdf_url` | Exact private object key returned by storage, one active pointer per user |

**State transitions**:

`idle` to `confirming` when an active resume exists, then `generating` to `rendering` to `uploading` to `success`. Cancel returns `confirming` to `idle`. Any processing state may enter `error`, and a later attempt may restart from `error`.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/resume/generate` | POST | No request body | `{ success: true, data: { resumeKey } }` | Current InsForge user required | `401` signed out, `422` incomplete profile, `500` render or storage failure, `502` OpenAI or invalid content |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Enable Generate Resume | Saved profile completeness | Existing `getProfileCompletion` result from the server loaded profile |
| Show replacement warning | Whether an active resume exists | Saved `profiles.resume_pdf_url` |
| Build model input | Candidate facts | Current authenticated user's saved profile row |
| Generate summary and bullets | Professional bounded prose | GPT-4o Structured Output grounded in the saved profile input |
| Render document identity and sections | Name, contact values, title, skills, roles, education | Saved profile facts, with summary and bullets from validated model content |
| Protect one page layout | Section counts and text length | Spec limits plus deterministic template styles |
| Resolve storage destination | `{user_id}/resume-{uuid}.pdf` | Authenticated user ID plus server generated UUID, never client input |
| Activate generated resume | `resume_pdf_url` and client `resumeKey` | Exact owned key returned by the successful private storage upload |

**Content and layout limits**:

* Summary is one paragraph with at most 80 words.
* Each work role has two or three bullets. Each bullet is at most 24 words.
* At most three roles and twelve skills render.
* Contact fields and links render only when present.
* The template uses one A4 page with fixed margins and no images.
* If the verified render is not exactly one page, the request fails safely rather than storing a document outside the contract.

**Key invariants**:

* Generation uses saved profile data, not unsaved browser draft values.
* Generated prose may rewrite supplied facts but may not create new facts.
* Model output cannot choose styles, storage paths, user IDs, or file names.
* Only a verified PDF buffer may enter private storage.
* The active resume key always belongs to the authenticated user.
* The profile pointer is updated before cleanup of the prior exact object key.
* A successful replacement immediately becomes the resume used by view and extraction.

**Security model**:

The route authenticates with the InsForge server client and reads the profile inside the current user boundary. Profile facts and generated content remain in memory. Logs contain only safe stage and provider metadata, never profile values, model output, PDF bytes, storage credentials, or the OpenAI key. The PDF stays in the private `resumes` bucket and is served only through the authenticated resume route.

**Configuration required**:

No new environment variables are required. Feature 08 reuses `OPENAI_API_KEY` and the existing InsForge configuration.

**Critical test scenarios**:

* Happy path: a complete profile generates one validated PDF, activates it, and exposes View current PDF, verifies **AC-1** through **AC-10**.
* Replacement: an existing resume requires confirmation and remains unchanged when cancelled, verifies **AC-2** and **AC-11**.
* Grounding: model content contains only supplied employers, dates, qualifications, skills, and responsibilities, verifies **AC-4** and **AC-5**.
* Layout limit: long but valid profile content renders as one readable page or fails before storage, verifies **AC-6**, **AC-7**, and **AC-11**.
* Provider, upload, or profile activation failure: the UI reports a safe retryable error and the prior active resume remains usable, verifies **AC-10** and **AC-11**.
* Auth and permission: a signed out request returns `401`, and one user cannot generate or replace another user's resume, verifies **AC-3** and **AC-11**.

## Build plan

The project uses a facade approach, and the disabled Feature 08 action already reserves the UI surface. This feature therefore builds the server path first, then activates the existing facade as one complete journey.

1. Add `@react-pdf/renderer` and define the strict generated content schema, profile projection, content caps, and safe error types, satisfies **AC-4** through **AC-7**, **AC-11**.
2. Add GPT-4o Structured Output generation grounded in the saved profile and normalize the bounded result, satisfies **AC-4**, **AC-5**, **AC-11**.
3. Add the deterministic server PDF document and buffer validation, then render representative long and sparse profiles to PNG for visual inspection, satisfies **AC-5** through **AC-7**.
4. Add authenticated `POST /api/resume/generate` with complete profile enforcement, unique owner scoped upload, exact returned key activation, prior object cleanup, and safe response mapping, satisfies **AC-1**, **AC-3**, **AC-7**, **AC-8**, **AC-11**.
5. Activate the existing profile action with replacement confirmation, loading lock, success and error announcements, and immediate active resume state, satisfies **AC-1**, **AC-2**, **AC-9**, **AC-10**.
6. Verify strict TypeScript, lint, production build, PDF visual quality, one page enforcement, authenticated replacement, signed out denial, and every critical scenario through `/check verify`, then update `context/ui-registry.md` and `context/progress-tracker.md`, satisfies **AC-1** through **AC-11**.

## Consequences

**Positive**:

* Users receive a polished resume from facts they have already reviewed and saved.
* Deterministic rendering makes privacy, layout, and storage behavior testable.
* The generated file works with the existing view and extraction flows.

**Negative and tradeoffs**:

* Generation adds model latency and cost.
* Strict one page limits may omit lower priority skills or older detail.
* One template does not support user selected visual styles in this feature.

**Neutral**:

* A storage key compatibility migration is required. No new credential is required.
* The generated document intentionally replaces the one active uploaded resume.

## Follow-up

* [ ] A later feature may add template selection or a longer resume format without changing the one active private resume boundary.
