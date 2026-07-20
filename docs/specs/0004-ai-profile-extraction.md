# 0004. AI profile extraction

**Date**: 2026-07-20
**Status**: Accepted

## Summary

Feature 07 reads the current user's active private resume and extracts profile values with GPT-4o. After a clear overwrite warning, supported values replace the matching form fields. Nothing is saved until the user reviews the result and selects Save Profile.

## Context

Feature 06 already gives each authenticated user one active private PDF and a complete profile form. Feature 07 must reduce manual data entry without weakening that storage boundary or changing profile data before the user reviews it.

Resume extraction is uncertain by nature. A model may omit information, format it differently, or return values that do not fit the form contract. The result therefore needs strict runtime validation and omission rules before it reaches the form.

The supported sections are Personal Info, Professional Info, Work Experience, and Education. Email and work authorization remain outside extraction because authentication and the user own those values. Job Preferences also remain outside extraction because a resume is not a reliable statement of current search preferences.

## Requirements

**User stories**:

* As a signed in user with an uploaded resume, I want to extract profile details so that I can complete my profile faster.
* As a user, I want to review and edit extracted values before saving so that the stored profile remains under my control.

**Acceptance criteria**:

* **AC-1**: An Extract from Resume action appears only when the authenticated user has an active resume.
* **AC-2**: Before extraction begins, the interface warns that every supported field found in the resume will replace the current value and requires explicit confirmation.
* **AC-3**: A confirmed request downloads only the current user's active private PDF, extracts its text, and sends that text to GPT-4o for structured extraction.
* **AC-4**: A successful result may populate full name, phone, location, LinkedIn URL, portfolio URL, current title, experience level, years of experience, skills, industries, up to three recent work roles, and education.
* **AC-5**: Email, work authorization, and every Job Preferences field remain unchanged.
* **AC-6**: A supported field replaces its current form value only when the validated extraction result contains a usable value. Missing, empty, uncertain, or invalid values leave the current field unchanged.
* **AC-7**: Work roles are ordered with the current role first and then by most recent start date. No more than three roles populate the form.
* **AC-8**: Extracted values exist only in the browser form draft. The database changes only after the user selects the existing Save Profile action.
* **AC-9**: The action exposes a loading state, prevents duplicate extraction requests, and announces success or a human readable error.
* **AC-10**: A PDF with fewer than 100 non whitespace text characters returns `Could not extract text from this PDF. Please try a different file.` and leaves the form unchanged.
* **AC-11**: Authentication failure, missing resume, private file download failure, PDF parsing failure, OpenAI failure, and invalid model output leave the form unchanged and return a safe error response.

## Options considered

### Option 1: Extract the active stored resume through an authenticated route

The server reads the active private PDF, parses its text, asks GPT-4o for a structured partial profile, and returns validated values to the existing form.

**Pros**:

* Reuses the accepted private storage and ownership boundary.
* Keeps PDF parsing and the OpenAI key on the server.
* Separates extraction from the user's explicit profile save.

**Cons**:

* Requires the PDF to finish uploading before extraction can begin.
* Adds a network round trip after upload.

### Option 2: Extract the selected file before upload

The client sends a newly selected file directly to a dedicated extraction request before or alongside storage.

**Pros**:

* Can begin extraction immediately after file selection.

**Cons**:

* Creates two competing file flows and more partial failure states.
* Can extract a file that never becomes the active stored resume.

### Option 3: Save extracted values immediately

The server writes the model result directly to the profile row after extraction.

**Pros**:

* Requires one less user action.

**Cons**:

* Removes the required review boundary.
* Lets uncertain model output overwrite stored personal data.

## Decision

**Chosen option**: Option 1, extract the active stored resume through an authenticated route.

Use `pdf-parse` for server side text extraction and the existing OpenAI project convention for GPT-4o structured JSON. Validate the parsed response against a strict extraction schema before returning it. Omit absent values instead of returning empty replacements.

**Implementation skills**: `openai-docs` (`openai/openai-docs`, system skill)

## Rationale

The active stored resume is already owner scoped, private, validated as a PDF, and available through authenticated server code. Reusing it gives extraction one source of truth and avoids a second upload path. The runner up was extraction before upload, but its small latency benefit does not justify inconsistent file state.

The form draft is the correct consistency boundary. Model output can help the user, but only the existing Save Profile action may make it durable. Partial output with omitted fields also prevents a sparse resume from erasing useful values.

## Feature design

**Data model sketch**:

No database migration is required.

| Shape | Fields | Rules |
|---|---|---|
| Existing active resume | `profiles.resume_pdf_url` | Nullable private object key owned by the authenticated user, governed by spec 0003 |
| Temporary extraction result | Optional supported personal, professional, work, and education fields | Returned only for usable values, never persisted |
| Work experience item | `company`, `title`, `startDate`, `endDate`, `currentRole`, `responsibilities` | Dates use `YYYY-MM`, current roles have no end date, maximum three |
| Education | `degree`, `fieldOfStudy`, `institution`, `graduationYear` | Graduation year uses `YYYY` when present |

The extraction result mirrors the relevant camel case fields in `ProfileData`. It excludes `email`, `authorization`, `jobTitles`, `remotePreference`, `salary`, `preferredLocations`, `coverLetterTone`, and `resumeKey`. Arrays are deduplicated and blank items are removed. Years of experience is a whole number from 0 through 80. Experience level is one of `junior`, `mid`, `senior`, or `lead`.

**State transitions**:

`idle` to `confirming` to `extracting` to `applied`, or `extracting` to `error`. Cancel returns `confirming` to `idle`. A new extraction may start from `applied` or `error`. Only a complete, validated response may enter `applied`.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/resume/extract` | POST | No request body, uses active resume | `{ success: true, data: PartialExtractedProfile }` | Current InsForge user required | `401` signed out, `404` no active resume, `422` unreadable or insufficient text, `500` private file failure, `502` OpenAI or invalid output |

Every response uses the project wrapper `{ success, data?, error? }`. The route owns authentication, private object download, PDF parsing, and response mapping. Extraction and schema logic live outside the route so the route contains no business logic.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Show Extract from Resume | Whether an active resume exists | Current `resumeKey` already loaded for the profile page |
| Show overwrite warning | Warning copy and supported field boundary | This spec, AC-2, AC-4, and AC-5 |
| Resolve resume | Private object key | Authenticated user's `profiles.resume_pdf_url` |
| Extract resume text | Plain resume text | Active PDF bytes parsed by `pdf-parse` |
| Produce supported values | Partial structured profile | GPT-4o response from extracted text, then strict runtime validation |
| Order work roles | Up to three roles | `currentRole`, normalized `startDate`, then original resume order as the stable tie breaker |
| Apply form draft | Replacement values | Validated fields present in the extraction response |
| Preserve excluded or absent fields | Existing form values | Current browser form draft before extraction |
| Save profile | Durable profile values | Existing Save Profile action after user review |

**Key invariants**:

* Extraction never writes to InsForge.
* The server never accepts a resume key or user ID from the client.
* Empty, missing, uncertain, and invalid model values never replace form values.
* A complete supported field from the validated result replaces the current draft value, even when that value is not empty.
* Email, work authorization, and Job Preferences cannot appear in the extraction response contract.
* Role and education dates match the existing form contract.
* The profile form remains usable after every extraction failure.

**Security model**:

Resume and profile data are personal information. The route authenticates through the InsForge server client, loads the profile inside the current user boundary, validates that the stored key belongs to that user, and downloads only that object from the private `resumes` bucket. PDF text and model output are processed in memory and are not logged. Errors may record operational context, but never resume text, model output, contact values, or the OpenAI key.

**Configuration required**:

* `OPENAI_API_KEY`: existing server only credential for the OpenAI request

**Critical test scenarios**:

* Happy path: a signed in user confirms extraction, all supported values found in the active resume replace the draft, excluded fields remain unchanged, and the database remains unchanged until Save Profile, verifies **AC-1** through **AC-9**.
* Sparse result: the model omits several fields, existing values for those fields remain unchanged, verifies **AC-6**.
* Role limit: a resume with more than three roles applies the current role and the next two most recent roles, verifies **AC-7**.
* Failure case: an image only or nearly empty PDF shows the required message and leaves every form field unchanged, verifies **AC-10**.
* Provider failure: a timeout or invalid OpenAI response shows a safe retryable error and leaves the form unchanged, verifies **AC-9** and **AC-11**.
* Auth and permission: a signed out request returns `401`, and one user cannot extract another user's resume, verifies **AC-3** and **AC-11**.

## Build plan

The project records a facade approach, but Feature 05 already delivered the interface and Feature 06 delivered the data boundary. Feature 07 therefore proceeds as one thin complete user journey through the existing surface.

1. Add the approved `openai`, `pdf-parse`, and `zod` dependencies and define the shared partial extraction schema that excludes unsupported fields, satisfies **AC-4** through **AC-7**.
2. Add server side PDF parsing, the 100 character content gate, the GPT-4o extraction prompt, structured response parsing, normalization, and runtime validation, satisfies **AC-3**, **AC-4**, **AC-6**, **AC-7**, **AC-10**, and **AC-11**.
3. Add the authenticated `/api/resume/extract` route using the active owner scoped private object and safe response contract, satisfies **AC-3**, **AC-10**, and **AC-11**.
4. Convert supported profile controls to one controlled browser draft while preserving the current Save Profile action and all unsupported fields, satisfies **AC-4** through **AC-8**.
5. Add the conditional Extract from Resume action, overwrite confirmation, loading lock, result application, and announced success and error states to the existing resume card, satisfies **AC-1**, **AC-2**, **AC-6**, **AC-8**, and **AC-9**.
6. Verify lint, strict TypeScript, production build, and every critical scenario through `/check verify`, then update `context/ui-registry.md` and `context/progress-tracker.md`, satisfies **AC-1** through **AC-11**.

## Consequences

**Positive**:

* Users avoid retyping resume facts while retaining final control over stored data.
* One private resume remains the source of truth for extraction.
* Partial validated output prevents missing resume details from clearing the form.

**Negative and tradeoffs**:

* Extraction adds OpenAI latency and usage cost.
* Existing populated fields are replaced when the resume supplies a supported value, so the confirmation warning is essential.
* Image only PDFs are not supported because optical character recognition is outside Feature 07.

**Neutral**:

* The profile table and storage schema do not change.
* The OpenAI API key already exists in `.env.local`.

## Follow-up

* [ ] Feature 08 may reuse the OpenAI client setup, but it must define its own generation prompt and response contract.
