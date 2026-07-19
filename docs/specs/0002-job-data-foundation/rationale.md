# Rationale for 0002. Job data foundation

## Context

Feature 04 is the last foundation step before profile and job features begin writing user data. The project has already selected InsForge for authentication, relational data, and storage. Spec 0001 establishes the authenticated user ID that owns all private application data.

The stored data includes contact details, employment history, job activity, and resume documents. Ownership cannot depend only on application filters because one omitted filter could expose another user data. The database and storage layer must enforce the same boundary.

The product lets users complete their profile over time. Most profile values therefore cannot be required at row creation. The project also names future concepts that are explicitly outside current product scope. Adding them now would create an unowned data contract before their behavior is designed.

## Options considered

### Option 1: One versioned migration with database enforced ownership

Create the current scope tables, constraints, indexes, policies, and bucket as one reviewable unit.

**Pros**:

* Every environment can reproduce the same foundation.
* Ownership survives application mistakes.
* Later features build against a clear contract.

**Cons**:

* The first migration is larger than creating tables only when each feature needs them.
* Policy and composite owner constraints need careful verification.

### Option 2: Manual dashboard setup

Create tables and storage directly in the InsForge dashboard, then document the result.

**Pros**:

* Fast for one development environment.
* Useful visual feedback while exploring the platform.

**Cons**:

* Environment drift is likely.
* Review and rollback are weak.
* A missed policy can remain invisible until real data exists.

### Option 3: Add persistence with each owning feature

Create only the profile table now, then add runs, jobs, logs, and storage later.

**Pros**:

* Each migration stays close to the code that uses it.
* Unused tables do not exist early.

**Cons**:

* Cross table ownership and deletion rules are decided in fragments.
* Feature 04 no longer fulfills its stated foundation purpose.
* Later work repeatedly changes the same security boundary.

## Rationale

One versioned migration best matches a foundation feature and the preference for automatic setup. It gives later work stable tables while keeping operational complexity inside the existing InsForge platform. Database policies are necessary because the records contain personal data and every project rule already requires user scoped access.

The schema keeps optional profile values nullable so users can fill them later. It deliberately excludes resume tailoring and stored completion detail because those are either outside scope or derived values that can become stale. The runner up was adding persistence per feature, but that would spread one ownership model across several changes and make security harder to verify as a whole.

Resume storage uses two layers. Feature 04 creates a private bucket and provides no client storage path. Current InsForge storage has no bucket media or size columns and no exposed object row policies, so the migration cannot honestly enforce per user paths or file validation there. Feature 06 will own an authenticated server boundary that constructs the owner key and validates the 10 MiB size, declared media type, and `%PDF-` prefix before upload. The prefix is only a basic file signature check, not proof that the full document is valid.
