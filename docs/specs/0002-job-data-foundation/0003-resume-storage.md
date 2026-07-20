# Resume storage

**Superseded in part by [spec 0003](../0003-profile-save-logic.md)**: InsForge automatically renames duplicate keys. Feature 06 therefore uses unique owner scoped keys and stores the returned key. The private bucket, validation limits, and authenticated access rules below remain in force.

## Summary

Feature 04 creates one private resume bucket. Feature 06 will add the authenticated server path that gives each user one predictable resume object without exposing a public URL.

## Decision

Create a private bucket named `resumes`.

| Property | Value |
|---|---|
| Bucket | `resumes` |
| Object key | `{user_id}/resume.pdf` |
| Feature 04 configuration | Bucket name and `public = false` |
| Feature 06 object key | `{user_id}/resume.pdf` |
| Feature 06 maximum objects per user | One active object |
| Feature 06 allowed declared media type | `application/pdf` |
| Feature 06 maximum size | 10 MiB, exactly 10,485,760 bytes |
| Feature 06 access | Authenticated server path verifies current owner |
| Feature 06 replacement | Replace at the same path using confirmed InsForge SDK semantics |

Current InsForge storage exposes private bucket configuration but does not expose object row level policies or bucket media and size constraint columns. Feature 04 therefore creates only the private bucket and exposes no application storage interface. It must not copy Supabase storage policy SQL into this migration.

`profiles.resume_pdf_url` stores the fixed object key `{user_id}/resume.pdf`, and a database check enforces that it matches the profile ID. It never stores a signed or public URL. Signed URLs are outside Feature 04 and are not assumed to exist.

Feature 06 must keep upload, read, replacement, and deletion behind an authenticated server path. Before upload it verifies the current user, constructs the fixed key itself, rejects files over 10,485,760 bytes, rejects any declared media type other than `application/pdf`, and rejects files shorter than five bytes or whose first five bytes are not `%PDF-`. This prefix check is basic file identification and does not prove that the full file is a valid PDF.

## Failure behavior

* Feature 04 keeps the bucket private and provides no client storage path.
* Feature 06 rejects any operation outside the exact current user path.
* Feature 06 rejects oversized files, wrong declared media types, short files, and files without the PDF prefix before upload.
* Feature 06 rejects cross user reads, replacements, and deletes through its server authorization boundary.
* Feature 06 must confirm replacement behavior from the installed SDK before implementing retry behavior because current storage documentation says duplicate upload keys may be renamed.

## Rationale

A fixed private path matches the product rule of one active resume per user and makes replacement idempotent. Public objects would expose personal documents to anyone with a URL, which is not acceptable for resume data.
