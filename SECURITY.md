# FinFlow security policy and future AI boundary

## Public configuration

The only approved browser configuration is:

```ini
VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Keep real development values in ignored `.env.local`. The publishable key and project URL are public identifiers; the key is expected in the browser bundle. They do not replace authentication or RLS. Secret/service-role keys, privileged JWTs, AI-provider keys, access tokens, database passwords and private signing keys must never appear in application source or a `VITE_` variable.

Vite validates the public environment through `scripts/public-env.mjs` before dev/build starts. It allows only the two variables above, rejects private/legacy key shapes, and rejects credential-bearing or malformed URLs. A format check is not a credential-validity check or a comprehensive secret scanner. Do not weaken the guard to add private provider credentials.

## Private financial files and Git

Use ignored `private-data/`, `receipts/`, `private-receipts/`, `income-documents/`, `uploads/`, `exports/` or `backups/` directories for local sensitive material. Financial CSV/spreadsheet/PDF files and common credential/database-dump formats are ignored. Real receipt photos must stay in those directories; arbitrarily named photos stored elsewhere are not guaranteed to match an ignore rule. Review any future image asset before staging it.

Keep dependencies, built assets, browser profiles, test screenshots, npm caches, local audit evidence and all real `.env*` files out of Git. Only `.env.example` is allowed. Ignore rules do not untrack files or remove historical content. Before every commit, inspect the exact staged filenames and run a secret scan against the index/history. The user-authorized portfolio destination is the public repository `mejj-mej/-finflow`. Verify its ownership and destination before every push; publish reviewed source only, never private financial material or credentials.

## Current data boundary

React derives the current user from Supabase Auth. Frontend data calls include user ownership and upload paths begin with the authenticated UUID. These checks improve correctness; live PostgreSQL RLS and private storage policies enforce authorization. Never use editable user metadata for authorization or disable RLS to repair a frontend error.

Receipt access uses 60-second signed URLs. Signed URLs are temporary bearer access: do not log them, commit them, or send them to analytics. Authentication sessions are managed by supabase-js and persisted in browser storage; no independent password or session-token store is implemented in the app. React text escaping must be preserved; never render untrusted receipt/OCR content through raw HTML.

## Future AI receipt recognition — architecture only

React frontend -> authenticated backend function -> AI provider.

1. React sends a transaction/receipt reference and the signed-in user's access token to an HTTPS backend function. It never receives a provider key.
2. The function verifies the token through Supabase Auth and derives the user identity server-side. It must not trust a submitted `user_id`.
3. Fetch the receipt metadata and private object under the caller's RLS context. Verify ownership and the expected bucket/path. Do not accept arbitrary remote URLs or generate public receipt links.
4. Validate actual file signatures, MIME, size, page count and image dimensions. Apply per-user rate limits, cost caps, timeouts and idempotency before invoking a provider. Keep provider credentials in backend-managed secrets only.
5. Send only necessary receipt information to the provider under an approved retention/privacy policy. Treat extracted text as untrusted data, including instructions embedded in receipts. Do not grant the extraction model unrestricted database tools.
6. Return a validated structured draft. Keep provider keys, access tokens, document bytes, signed URLs and personal details out of logs and errors. Any server use of privileged Supabase keys requires explicit authorization checks and is never a substitute for ownership checks.
7. Require the user to review and confirm the draft before recording a transaction. Income evidence requires confirmed payment, sensitive-document handling and gross/deduction/net separation; an unpaid invoice is not received income.

No AI backend, paid provider call or automatic posting is enabled by this policy.

## If a credential is exposed

Stop commits, pushes and deployment. Revoke/rotate the affected credential through its provider first; deleting source text or making a repository private does not invalidate it. Review provider/database audit logs for misuse, replace local/backend configuration, and invalidate affected user sessions if applicable. Remove the credential from the index/current tree, rebuild assets, and inspect CI artifacts, caches and releases.

If Git history contains it, prepare a separate history-remediation plan with the repository owner and collaborators. Obtain explicit approval before rewriting history or force-pushing; address clones, forks and cached copies too. Rescan both the candidate index and history before proceeding. A publishable Supabase key by itself is not a private credential and does not require secret-key rotation solely because it appears in an expected browser bundle.

## Sources

- [Supabase API key security](https://supabase.com/docs/guides/getting-started/api-keys)
- [Vite public environment variables](https://vite.dev/guide/env-and-mode)
- [PostgreSQL row security and table-wide privileges](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
