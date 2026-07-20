# Server side AI extraction

- Governing spec: `docs/specs/0004-ai-profile-extraction.md`.
- Keep OpenAI credentials, resume text, model requests, and response validation on the server.
- Never log resume text, model output, contact values, or credentials. Operational errors may include safe parser or provider metadata only.
- Use strict Structured Outputs plus application boundary validation. Model boundary schemas must use only formats supported by the OpenAI endpoint.
- Keep `pdf-parse` in `serverExternalPackages` so Next.js loads the PDF worker from the installed package instead of bundling a missing worker chunk.
- Extraction returns a reviewable browser draft only. It never writes profile values to InsForge.

_Drafted by /sync from the introducing change, worth a quick human pass._
