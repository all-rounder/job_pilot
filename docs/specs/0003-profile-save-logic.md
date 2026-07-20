# 0003. Profile save and resume access

**Date**: 2026-07-20
**Status**: Accepted

## Summary

Feature 06 will replace placeholder profile data with authenticated InsForge reads and explicit saves. Valid partial profiles may be saved, while completion details are derived from the stored profile. Resume files use one active private object per user behind authenticated server access.

## Context

Feature 05 delivered the complete profile interface with placeholder data. Feature 06 must connect that interface to the accepted `profiles` table and private `resumes` bucket without expanding into resume extraction or generated resumes.

Profile and resume data contain personal information. Every read and mutation must identify the current InsForge user and remain inside that user boundary. The existing database enforces row ownership, and the storage design requires the application to enforce object ownership.

The page also needs one reliable definition of completion. Persisting percentage and missing field lists would duplicate profile state and allow those values to become stale.

The installed InsForge SDK automatically renames a duplicate storage key. The earlier fixed key assumption in the resume storage child of spec 0002 cannot provide safe replacement. Feature 06 therefore needs owner scoped unique keys and must store the exact key returned by storage.

## Requirements

**User stories**:

* As a signed in job seeker, I want to save a partial or complete career profile so that I can return and continue later.
* As a signed in job seeker, I want my existing profile to fill the form so that I can review and edit current information.
* As a signed in job seeker, I want to replace and access my private PDF resume so that JobPilot can use one current document.

**Acceptance criteria**:

* **AC-1**: The profile page reads the current user's `profiles` row on the server and fills every supported form field. A user with no row receives an empty form with email taken from the authenticated identity.
* **AC-2**: Selecting Save Profile validates the complete submission, then inserts or updates only the current user's profile through one atomic database operation. Valid partial profiles are saved and invalid submissions change nothing.
* **AC-3**: Completion percentage and missing fields are derived from the same required field definition on every read and save. Only `is_complete` is persisted.
* **AC-4**: `profile_completed` is captured only when a successful save changes the profile from incomplete to complete for the first time.
* **AC-5**: Selecting a valid PDF uploads it immediately to the private `resumes` bucket under `{user_id}/`, stores the exact returned key in `profiles.resume_pdf_url`, then removes the prior object. The user has one active resume even if cleanup must be retried.
* **AC-6**: Resume upload rejects files larger than 10,485,760 bytes, files whose declared type is not `application/pdf`, files shorter than five bytes, and files without the `%PDF-` prefix. Rejection preserves the prior resume and profile data.
* **AC-7**: Resume read and delete operations are authenticated and limited to the stored object key after verifying that it belongs to the current user's prefix. Delete clears `resume_pdf_url` only after object deletion succeeds.
* **AC-8**: Save, upload, read, and delete failures show a human readable retry path. The page preserves entered form values after validation or save failure.
* **AC-9**: Signed out callers and one user attempting to access another user's data receive no profile or resume content.

## Options considered

### Option 1: Explicit profile save with immediate resume upload

The form saves all profile fields through one Server Action. Resume selection uses a separate authenticated mutation immediately because file storage has different validation and failure behavior.

**Pros**:

* Gives the user one clear profile commit point.
* Keeps file failure separate from profile field changes.
* Makes each mutation safe to retry.

**Cons**:

* The page has two independent pending and error states.
* A resume may be stored before other profile edits are saved.

### Option 2: One combined profile and resume submission

The form and optional file are submitted together and processed as one user action.

**Pros**:

* Presents one save action to the user.
* Can validate profile fields and the selected file in one request.

**Cons**:

* Database and object storage cannot form one transaction.
* A storage failure creates ambiguous rollback behavior for valid profile changes.

### Option 3: Automatic profile saving

The browser saves fields as the user edits them and uploads the resume separately.

**Pros**:

* Reduces the chance that navigation loses recent edits.
* Removes the need for a manual profile save.

**Cons**:

* Adds debounce, concurrency, and stale response handling.
* Produces more database writes without a stated user need.

## Decision

**Chosen option**: Option 1, Explicit profile save with immediate resume upload

Use one authenticated Server Action for the full profile submission and separate authenticated resume operations. Derive completion state from profile fields and keep `profiles` as the only profile record.

## Rationale

The current interface already has an explicit Save Profile action. Keeping profile and resume mutations separate avoids pretending that database and object storage changes are atomic. A unique resume key also matches the storage provider's real behavior and lets replacement preserve the prior file until the new database pointer is durable.

The runner up is one combined submission because it looks simpler in the interface. It is weaker operationally because a partial failure needs compensation across two systems. Automatic saving adds concurrency behavior that the product does not need yet.

## Feature design

**Data model sketch**:

| Entity | Key fields | Rules and relationships |
|---|---|---|
| `auth.users` | `id` uuid, authenticated email | One user owns zero or one profile. Authentication is defined by spec 0001. |
| `profiles` | `id` uuid primary key and foreign key, `email` required, scalar profile fields nullable, array fields required with empty defaults, `work_experience` required JSON array, `education` nullable JSON object, `resume_pdf_url` nullable, `is_complete` required, `first_completed_at` nullable timestamp | Existing table from spec 0002 with one additive completion timestamp and a revised resume key constraint. `id` equals the current user ID. `resume_pdf_url` is null or starts with `{id}/resume-` and ends with `.pdf`. `first_completed_at` changes from null once and is then immutable. |
| `work_experience` value | `company`, `title`, `start_date`, `end_date`, `current_role`, `responsibilities` | Stored as an ordered JSON array with at most three roles. `end_date` is required unless `current_role` is true. |
| `education` value | `degree`, `field_of_study`, `institution`, `graduation_year` | Stored as one JSON object or null when the section is empty. |
| Private resume object | bucket `resumes`, key `{user_id}/resume-{random_uuid}.pdf` | One active key is referenced per user. The application creates the requested key, stores the exact returned key, and never accepts a key from the client. Superseded objects are cleanup candidates, never active records. |

**State transitions**:

* Profile completion: no row to incomplete, incomplete to incomplete, incomplete to complete, complete to complete, and complete to incomplete when a later edit removes required data.
* Analytics: capture `profile_completed` only when the atomic save changes `first_completed_at` from null to the current database time. A later complete to incomplete to complete cycle does not capture it again.
* Resume: absent to present, present to replaced, and present to absent. A failed operation leaves the prior state unchanged.

**Required profile fields**:

`full_name`, authenticated `email`, `phone`, `location`, `current_title`, `experience_level`, `years_experience`, at least one nonempty `skills` entry, at least one valid `work_experience` role, complete `education`, at least one nonempty `job_titles_seeking` entry, `remote_preference`, and `work_authorization`.

URLs, industries, salary expectation, preferred locations, cover letter tone, and resume are optional. Completion percentage is the number of satisfied required items divided by the total number of required items, rounded to the nearest whole number. A grouped item such as education counts once and is satisfied only when every required child field is valid.

**API surface**:

| Surface | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `app/(protected)/profile/page.tsx` | Server read | Current session | Profile form data, completion percentage, missing fields, resume presence | Current user | Signed out redirect, read failure state |
| `saveProfile` in `actions/profile.ts` | Server Action | All supported profile form fields | Success, field errors, form error, completion state, first completion transition | Current user | Invalid field, database failure, signed out |
| `uploadResume` in `actions/profile.ts` | Server Action | `resume` File | Success, fixed object key | Current user | Invalid PDF, oversize file, storage failure, database update failure |
| `/api/resume` | GET | Current session | Private PDF response, filename, media type | Current user | Not found, storage failure, signed out |
| `deleteResume` in `actions/profile.ts` | Server Action | No client object key | Success | Current user | Not found, storage failure, database update failure, signed out |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Render profile | User identity and email | InsForge current user |
| Render profile | Form field values and prior completion state | Current user's `profiles` row |
| Render profile | Completion percentage and missing field labels | Shared completion function applied to normalized profile data |
| Render profile | Resume presence | `profiles.resume_pdf_url` |
| Save profile | Profile owner and row key | InsForge current user ID, never form input |
| Save profile | Normalized scalar, array, and JSON values | Validated form submission |
| Save profile | `is_complete` | Shared completion function applied to validated values |
| Save profile | First completion event decision | Atomic save result indicating that `first_completed_at` changed from null |
| Upload resume | Requested object key | Current user ID plus `/resume-`, a server generated random UUID, and `.pdf` |
| Upload resume | Active object key | Exact key returned by InsForge after verifying the current user prefix |
| Upload resume | Size, declared media type, and signature | Selected File metadata and first five file bytes |
| Read resume | Object key | Current profile row after verifying the current user prefix |
| Delete resume | Object key and DB value to clear | Current profile row after verifying the current user prefix |

**Key invariants**:

* The client never supplies a profile owner ID or resume object key.
* Email comes from the authenticated identity and cannot be changed by the form.
* Profile input normalization and completion use one shared server safe schema and one shared completion function.
* Arrays contain trimmed, nonempty, de duplicated values. Work experience contains no more than three roles.
* A validation failure performs no database or storage mutation.
* One versioned migration adds `first_completed_at` and an authenticated profile save function. The function owns insert or update, completion state, the immutable first completion timestamp, and its transition result in one transaction.
* Resume validation finishes before storage is called.
* Every requested resume key is unique, so InsForge duplicate key renaming is not part of normal replacement.
* The returned key must remain inside `{current_user_id}/` and match the resume PDF key shape before it is stored.
* The database stores the private object key, never a public or signed URL.
* Replacement uploads and validates the new object, changes the database pointer, then removes the old object. A database update failure removes the new object and preserves the old pointer. Old object cleanup failure is logged and can be retried without changing the active pointer.
* Profile reads and writes are strongly consistent from the database response. The page is revalidated after successful mutations.

**Security model**:

Profile and resume content are personal data. Every server surface verifies the current InsForge user. Profile queries also filter by that user ID, with forced row level security as defense in depth. Resume operations accept no client key, verify the stored key begins with `{current_user_id}/resume-`, and use the private bucket. Responses use `application/pdf`, a safe attachment filename, and `Cache-Control: private, no-store`.

No public resume URL is created or stored. Raw backend errors are logged with operation context but are never returned to the user.

**Critical test scenarios**:

* Happy path: a new user saves a partial profile, returns to see it filled, completes it, and receives one completion event, verifies **AC-1**, **AC-2**, **AC-3**, and **AC-4**.
* Happy path: a user uploads, reads, replaces, and deletes one active private PDF through its stored owner scoped key, verifies **AC-5** and **AC-7**.
* Failure case: an invalid or oversized file is rejected before storage and the prior resume remains available, verifies **AC-6** and **AC-8**.
* Failure case: an invalid profile submission preserves entered values and changes no stored fields, verifies **AC-2** and **AC-8**.
* Auth and permission: signed out requests and cross user attempts return no profile or resume content, verifies **AC-9**.

## Build plan

The project uses a Facade approach. Feature 05 already delivered the interface, so this plan now replaces each placeholder path with a complete server backed path.

1. Add a versioned migration for immutable `profiles.first_completed_at`, the revised owner scoped resume key constraint, and an authenticated atomic profile save function that returns whether first completion occurred, satisfies **AC-2**, **AC-3**, **AC-4**, **AC-5**, and **AC-9**.
2. Define shared profile types, normalization, validation, required field completion, and mappings between form names and the accepted database shape, satisfies **AC-1**, **AC-2**, and **AC-3**.
3. Load the current user's profile in the protected Server Component and replace placeholder bindings with empty or stored values plus derived completion data, satisfies **AC-1**, **AC-3**, and **AC-9**.
4. Add `saveProfile` using the atomic save function, page revalidation, preserved form state, and first completion event capture from the function result, satisfies **AC-2**, **AC-3**, **AC-4**, **AC-8**, and **AC-9**.
5. Add immediate validated upload with a unique owner scoped key, atomic pointer replacement, and cleanup of the superseded object, satisfies **AC-5**, **AC-6**, **AC-8**, and **AC-9**.
6. Add authenticated private resume read and delete paths, including safe response headers and database key cleanup, satisfies **AC-7**, **AC-8**, and **AC-9**.
7. Wire pending, success, validation, and retry states into the existing profile facade without changing its design language, satisfies **AC-2**, **AC-5**, **AC-6**, **AC-7**, and **AC-8**.
8. Verify retry safety, concurrent first completion, storage replacement, cross user denial, responsive behavior, accessibility, lint, strict TypeScript, and the production build, satisfies **AC-1** through **AC-9**.

## Consequences

**Positive**:

* Profile completion has one definition and cannot drift from stored fields.
* Users can save progress without satisfying every completion requirement.
* Resume failures do not roll back valid profile changes.
* Private resume ownership is enforced at both the application and database boundaries.

**Negative and tradeoffs**:

* The page must manage profile and resume mutations independently.
* Immediate upload means selecting a valid file changes stored state before Save Profile is selected.
* A failed old object cleanup can temporarily leave an unreferenced private object that needs a later retry.
* JSON profile sections require careful server validation because the database only checks their outer JSON type.

**Neutral**:

* One additive database migration is required. No new environment variable is required.
* Feature 07 owns resume text extraction. Feature 08 owns generated resume PDFs.

## Follow-up

* [ ] Enroll Feature 06 in `docs/scope/` if this project adopts the scope workflow. The current feature list lives in `context/build-plan.md`.
