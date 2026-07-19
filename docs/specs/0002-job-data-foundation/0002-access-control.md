# Access control

## Summary

InsForge row level security enforces one owner for every application row. Application filters remain required, but they are not the final security boundary.

## Decision

Enable and force row level security on `profiles`, `agent_runs`, `jobs`, and `agent_logs`. Policies resolve the current user with `auth.uid()`, the InsForge JWT subject helper. The authenticated browser and server clients are subject to every policy. The migration administrator is the only intended bypass role. Do not create an anonymous access policy.

### Policies

| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| `profiles` | Authenticated ID equals `id` | Authenticated ID equals `id` | Existing and new `id` equal authenticated ID | Authenticated ID equals `id` |
| `agent_runs` | Authenticated ID equals `user_id` | New `user_id` equals authenticated ID | Existing and new `user_id` equal authenticated ID | Authenticated ID equals `user_id` |
| `jobs` | Authenticated ID equals `user_id` | New `user_id` equals authenticated ID | Existing and new `user_id` equal authenticated ID | Authenticated ID equals `user_id` |
| `agent_logs` | Authenticated ID equals `user_id` | New `user_id` equals authenticated ID | Existing and new `user_id` equal authenticated ID | Authenticated ID equals `user_id` |

Use both visibility predicates and new row checks for inserts and updates. Profile email is a display copy and is not part of any policy. The positive and cross user verification must run through the normal authenticated server client, not an administrator connection.

### Relationship ownership

Composite foreign keys prevent a child from pointing at another user parent. This applies to job to run, log to run, and log to job relationships.

### Deletion

Deleting `profiles` cascades to every relational child. Deleting a run cascades to its jobs and logs. Deleting a job cascades to its related logs. The verification procedure must cover these multiple paths and prove no orphan or constraint error remains. Storage deletion is a separate application action and cannot be handled by relational cascades.

## Rationale

Application scoping is easy to omit and is already named as a project invariant. Row level security makes the database reject cross user access, while composite keys close the less obvious path where a user owns a child row but references another user parent.
