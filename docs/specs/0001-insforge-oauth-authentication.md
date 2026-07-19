# 0001. InsForge OAuth authentication

**Date**: 2026-07-18
**Status**: Accepted

## Summary

JobPilot will use InsForge for Google and GitHub sign in. The InsForge SSR helpers own the OAuth exchange and persist the session in server managed cookies. Next.js protects private pages with route level user checks, while `proxy.ts` refreshes the session and performs an early redirect for signed out requests.

## Context

Feature 02 must add sign in before any private JobPilot data or pages are built. The application already names InsForge as its backend and limits sign in to Google and GitHub.

Next.js 16 calls request middleware `proxy.ts` and warns that Proxy is not a complete authorization boundary. The current InsForge SSR documentation requires OAuth to start on the server, stores the PKCE verifier in an HTTP only cookie, and exchanges `insforge_code` once in a Route Handler. This lets access and refresh tokens remain in server managed cookies that Server Components can use.

## Requirements

**User stories**:

- As a visitor, I want to sign in with Google or GitHub so that I can access JobPilot without creating another password.
- As a signed out visitor, I want private pages to send me to login so that private application data is not exposed.

**Acceptance criteria**:

- **AC-1**: `/login` displays accessible Google and GitHub sign in controls that match the existing JobPilot design system.
- **AC-2**: Choosing either provider starts InsForge OAuth and returns a successful user to `/dashboard`.
- **AC-3**: OAuth cancellation or failure returns the user to login with a clear, non sensitive error and allows retry.
- **AC-4**: Signed out requests to `/dashboard`, `/profile`, `/find-jobs`, and `/find-jobs/[id]` redirect to `/login`.
- **AC-5**: A valid browser session survives navigation and refresh, and invalid or expired sessions are treated as signed out.
- **AC-6**: Signing out clears the InsForge session and returns the user to `/login`.

## Options considered

### Option 1: InsForge SSR OAuth with route level checks

Use the current InsForge SSR helpers for OAuth exchange and session persistence. Complete the callback on the server, check the current user at each protected route boundary, and use Proxy for refresh plus an early redirect.

**Pros**:

- Matches the selected backend and current SDK behavior.
- Keeps authorization checks close to protected content.

**Cons**:

- Protected route shells need a shared guard or repeated server checks.
- The flow needs a callback Route Handler and refresh Route Handler.

### Option 2: Browser only callback and browser managed session

Let a browser client exchange the OAuth code and manage the session without the InsForge SSR helpers.

**Pros**:

- Uses fewer server files for a client rendered application.

**Cons**:

- Does not provide the shared server session required by Server Components and protected routes.
- Places callback handling in the browser when the installed SDK recommends a server exchange for Next.js.

### Option 3: A second hosted authentication provider

Add another auth product and connect its identities to InsForge data.

**Pros**:

- Could provide more prebuilt identity features later.

**Cons**:

- Adds identity synchronization and another operational dependency without a current requirement.

## Decision

**Chosen option**: Option 1: InsForge SSR OAuth with route level checks

Use `createAuthActions` to start OAuth on the server. Store the returned PKCE verifier in an HTTP only cookie, exchange `insforge_code` once in `/api/auth/callback`, and confirm users in protected Server Components through `createServerClient`. Use `updateSession` in `proxy.ts` to refresh session cookies before rendering.

## Rationale

InsForge is already the system of record for identity, database, and storage. Its SSR helpers keep the PKCE verifier and refresh token out of browser JavaScript while making the same session available to Server Components. Route level checks remain the authoritative guard because Next.js states that Proxy is only suitable for optimistic checks.

## Feature design

**Data model sketch**:

- InsForge owns users, provider identities, access tokens, refresh cookies, and session expiry.
- JobPilot adds no authentication table in this feature.
- The later `profiles.id` field will reference the InsForge user ID.

**State transitions**:

`signed out` to `authorizing` to `signed in`. Cancellation or provider failure returns to `signed out`. Expiry or sign out moves `signed in` to `signed out`.

**API surface**:

| Surface | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `signInWithProvider` | Server Action | provider | provider redirect, PKCE verifier cookie | public | provider unavailable, invalid redirect |
| `/api/auth/callback` | GET | `insforge_code`, verifier cookie | access and refresh cookies, dashboard redirect | public callback | missing code, missing verifier, exchange failure |
| `/api/auth/refresh` | POST | refresh cookie | renewed access and refresh cookies | session optional | invalid or expired refresh token |
| `createInsForgeServerClient().auth.getCurrentUser` | SDK call | current access cookie | user or null | session optional | invalid access token |
| `signOut` | Server Action | current session cookies | cleared session, login redirect | authenticated | provider sign out failure |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Render login | Provider labels and actions | Feature 02 build plan |
| Start OAuth | Provider | Button choice, limited to `google` or `github` |
| Start OAuth | Callback target | `NEXT_PUBLIC_APP_URL` plus `/api/auth/callback` |
| Start OAuth | PKCE verifier | InsForge `signInWithOAuth` result, stored in an HTTP only cookie |
| Complete OAuth | User and persisted session | One server exchange of `insforge_code` and the verifier |
| Protect route | Signed in state | Server client `getCurrentUser` result at the route boundary |
| Show auth failure | Safe error message | InsForge structured error mapped to approved UI copy |

**Key invariants**:

- Only `google` and `github` are accepted provider values.
- The anonymous key may be public, but provider secrets, PKCE verifiers, refresh tokens, and privileged keys never enter browser JavaScript.
- The callback exchanges each authorization code at most once and deletes the verifier cookie.
- A Proxy redirect is never treated as the only authorization check.
- Auth failures never display tokens, provider responses, or raw internal errors.

**Security model**:

- `/login` and the OAuth start action are public.
- Dashboard, profile, and job routes require a confirmed InsForge user.
- Proxy refresh and redirect are an optimistic check. Protected layouts, Server Actions, and Route Handlers remain authoritative.
- Future server actions and route handlers must verify the user independently, even when their page is protected.

**Configuration required**:

- `NEXT_PUBLIC_INSFORGE_URL`: public InsForge backend URL used by the SSR helpers.
- `NEXT_PUBLIC_INSFORGE_ANON_KEY`: public anonymous SDK key.
- `NEXT_PUBLIC_APP_URL`: canonical application origin used to construct the OAuth callback URL.
- Google and GitHub credentials configured in InsForge Auth Methods.
- Local and deployed `/api/auth/callback` URLs included in InsForge allowed redirect URLs.

**Critical test scenarios**:

- Happy path: Google and GitHub each return to `/dashboard` with a persistent user session, verifies **AC-1**, **AC-2**, and **AC-5**.
- Failure case: OAuth cancellation or SDK failure returns to retryable login UI without leaking details, verifies **AC-3**.
- Auth permission: a signed out browser cannot render any protected route, verifies **AC-4**.
- Sign out: a signed in browser clears the session and cannot reopen a protected route, verifies **AC-6**.

## Build plan

1. Install the current InsForge SDK and create environment validated server and browser clients, satisfies **AC-2** and **AC-5**.
2. Build the login page and provider controls using existing tokens and shared layout patterns, satisfies **AC-1** and **AC-3**.
3. Add server OAuth start actions, the callback exchange, and the refresh route, satisfies **AC-2**, **AC-3**, and **AC-5**.
4. Add shared server route protection and Next.js `proxy.ts` session refresh plus optimistic redirect, satisfies **AC-4** and **AC-5**.
5. Add sign out behavior and verify both providers, refresh, failure, and protected routes, satisfies **AC-2**, **AC-3**, **AC-4**, **AC-5**, and **AC-6**.

## Consequences

**Positive**:

- JobPilot has one identity system and a small authentication surface.
- The design follows current InsForge and Next.js contracts.

**Negative / tradeoffs**:

- Route protection cannot rely on Proxy alone, so protected Server Components also confirm the user.
- SSR OAuth requires a callback route and one short lived PKCE verifier cookie.
- End to end provider verification requires valid Google and GitHub configuration outside the repository.

**Neutral**:

- The build plan is an end to end slice because no separate project delivery approach is recorded.
- PostHog identify and reset remain Feature 03 work.

## Follow-up

- [x] Verify both deployed provider credentials and allowed redirect URLs in the InsForge dashboard before acceptance testing.
