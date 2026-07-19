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
- `app/(protected)/profile/page.tsx`: basic authenticated account summary with branded header, identity details, profile readiness state, and dashboard navigation until Feature 05 adds the full form

### Analytics infrastructure

- `components/analytics/PostHogProvider.tsx`: root client context for the shared PostHog browser instance
- `components/analytics/PostHogIdentify.tsx`: invisible protected route identity bridge with no visual classes
