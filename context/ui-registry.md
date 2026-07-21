# UI Registry

Living document. Updated after every component is built. Read this before building any new component — match existing patterns exactly before inventing new ones.

---

## How to Use

Before building any component:

1. Check if a similar component already exists here
2. If yes — match its exact classes
3. If no — build it following ui-rules.md and ui-tokens.md, then add it here

After building any component — update this file with the component name, file path, and exact classes used.

---

## Components

### Homepage shell

- `components/layout/Navbar.tsx`: 64px token based header, responsive primary navigation and CTA
- `components/layout/Footer.tsx`: bordered surface with responsive brand and footer links
- `components/homepage/Hero.tsx`: gradient hero, paired CTAs, framed dashboard preview
- `components/homepage/Features.tsx`: alternating two column feature panels and supplied product imagery
- `components/homepage/Testimonial.tsx`: success story and gradient closing CTA

### Authentication

- `app/(auth)/login/page.tsx`: responsive two panel sign in screen with brand context, provider actions, legal links, and an announced retryable error state
- `components/auth/OAuthButton.tsx`: full width provider action using `min-h-12`, `rounded-lg`, token borders, hover accent, focus ring, disabled opacity, and `useFormStatus` loading copy
- `components/auth/SignOutButton.tsx`: bordered session action using `min-h-11`, token hover and focus states, disabled opacity, and `useFormStatus` loading copy
- `app/(protected)/dashboard/page.tsx`: temporary authenticated landing surface until Feature 14 replaces it with the full dashboard
- `app/(protected)/profile/page.tsx`: protected profile route with page metadata, authenticated InsForge profile loading, empty state fallback, and derived completion data

### Profile

- `components/profile/ProfilePage.tsx`: complete responsive profile surface with active navigation, live completion status, private resume upload, view, replace and delete controls, confirmed AI extraction into a reviewable controlled form draft, saved profile PDF generation with replacement confirmation, explicit profile save feedback, and a semantic grouped career profile form
- Resume extraction uses the existing token based card, a conditional `min-h-11` accent action, native overwrite confirmation, disabled loading state, and an atomic polite live status region
- Resume generation reuses the resume card action row, gates on saved profile completion, confirms active resume replacement, locks duplicate requests, and announces success or error through an atomic polite live region
- Profile fields use `min-h-11`, `rounded-md`, token borders and surfaces, token focus rings, responsive grids, and native form controls
- `app/(protected)/profile/loading.tsx`: token based loading skeleton for the authenticated profile route
- `app/api/resume/route.ts`: authenticated private PDF delivery surface with owner key validation and private no store response headers

### Analytics infrastructure

- `components/analytics/PostHogProvider.tsx`: root client context for the shared PostHog browser instance
- `components/analytics/PostHogIdentify.tsx`: invisible protected route identity bridge with no visual classes

### Find Jobs

- `app/(protected)/find-jobs/page.tsx`: protected route metadata and server page wrapper
- `components/find-jobs/FindJobsPage.tsx`: token based Find Jobs header, real search controls with loading and error states, success and partial result banner, URL backed filter toolbar, server sourced score rows, empty and retry states, and eight row pagination
- `app/api/jobs/route.ts`: authenticated owner scoped paged job listing read with URL filters, sorting, total counts, and safe errors
- `lib/jobs.ts`: shared Find Jobs query normalization, URL serialization, page metadata, and owner scoped database listing helper
- Find Jobs inputs use `min-h-11` or `min-h-14`, `rounded-md`, token borders and surfaces, token focus rings, and native select controls
- Find Jobs result rows use `border-border`, `bg-surface-secondary` hover states, token score colors, and horizontal overflow below the desktop table width
