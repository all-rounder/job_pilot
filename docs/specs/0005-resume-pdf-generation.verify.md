# Verify: Resume PDF generation, spec 0005

## UI and authenticated journey

- [ ] Open `/profile` with an incomplete saved profile. Confirm Generate Resume is disabled and the helper says to complete and save the profile. This proves completion comes from the saved profile, not unsaved form edits. Covers AC-1.
- [ ] Complete fields without selecting Save Profile. Confirm generation remains unavailable. Save the profile and confirm Generate Resume becomes available. Covers AC-1 and AC-3.
- [ ] With an active resume, select Generate Resume. Dismiss the replacement warning and confirm the active View current PDF still returns the prior file. Covers AC-2 and AC-11.
- [ ] Confirm generation. While it runs, confirm the button says Generating and cannot be selected again. Covers AC-10.
- [ ] Confirm success is announced and View current PDF plus Extract from Resume are available without reloading. Covers AC-9 and AC-10.
- [ ] Open View current PDF. Confirm the document contains the saved name, contact values, current title, skills, no more than three roles, and education. Confirm it excludes authorization, preferences, salary, and cover letter tone. Covers AC-5.

## PDF and content

- [ ] Render a complete profile with three long roles and twelve skills. Confirm the stored PDF has a `%PDF-` signature, exactly one A4 page, readable text, consistent spacing, and no overlap or clipping. Covers AC-6 and AC-7.
- [ ] Compare the summary and bullets with the saved profile. Confirm all employers, dates, qualifications, skills, and claims are grounded in the saved values. Covers AC-4.
- [ ] Confirm the summary is at most 80 words, each role has two or three bullets, and every bullet is at most 24 words. Covers AC-4 and AC-6.

## API, ownership, and failure

- [ ] Send `POST /api/resume/generate` while signed out. Expect `401` and the safe response wrapper. Covers AC-3 and AC-11.
- [ ] Send the request for an incomplete saved profile. Expect `422` and no storage or profile change. Covers AC-1 and AC-11.
- [ ] Confirm the request has no body and the route resolves profile facts, user ID, and destination key from the authenticated user. Covers AC-3.
- [x] After success, confirm the private object key is `{authenticated_user_id}/resume-{uuid}.pdf`, its MIME type is `application/pdf`, and `profiles.resume_pdf_url` matches the exact key returned by storage. Live storage confirms one active pointer and one matching object. Covers AC-8.
- [x] Generate and remove a replacement resume. Confirm the prior exact object is removed, the profile pointer follows the replacement, and no provider renamed `resume (N).pdf` objects remain. Confirmed by the user and live storage inspection. Covers AC-2, AC-8, and AC-11.
- [ ] Confirm a second authenticated user cannot view, generate, replace, or extract the first user's resume. Covers AC-3, AC-8, and AC-11.
- [ ] Force an OpenAI failure, invalid structured response, render failure, multi page result, and storage failure separately. Each must return a safe error, log no profile values or generated content, and preserve the prior active resume unless replacement upload completed. Covers AC-7, AC-10, and AC-11.

## Commands

- [x] `npx tsc --noEmit`, exits successfully.
- [x] `npm run lint`, exits successfully.
- [x] `npm run build`, exits successfully and lists `/api/resume/generate`.
- [x] Live representative GPT-4o generation plus actual React PDF render, returns a one page PDF.
- [x] Rasterized sample inspection, confirms the corrected header, section hierarchy, three roles, education, and no clipping or overlap.
