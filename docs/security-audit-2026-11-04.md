# Pre-commit security audit — 2026-11-04 (Asia/Manila)

Target: `mejj-mej/finflow-ai`, private only. Proposed repository root: `finflow-ai-phase2/`. This is an audit and local hardening pass; no real repository was initialized, staged, committed, pushed, created remotely or deployed.

## First-publication authorization update

The user subsequently approved a first commit and public portfolio push, and corrected the destination to **`mejj-mej/-finflow`** (leading hyphen). This supersedes the original private `finflow-ai` proposal below. GitHub's public API confirmed owner/name and public visibility; `git ls-remote --symref` returned no refs, confirming an empty destination before staging. The old 404 destination was not used.

Git was initialized only inside `finflow-ai-phase2/` with branch `main`. Origin is exactly `https://github.com/mejj-mej/-finflow.git`. No existing remote was overwritten. A command-scoped safe-directory setting handles the sandbox-created Git ownership mismatch; no global Git security setting was weakened.

Before this first publication: the production build and all 13 tests passed; npm audit reported zero known vulnerabilities; the repeated source/generated-asset scan found no private credentials; and the real repository passed 12 included/excluded path checks. The exact 25-file candidate is listed in `docs/pre-commit-files.txt`. Private environments, actual receipts/exports, browser evidence, dependencies and generated builds remain excluded. Staged blobs must pass a final scan and whitespace check before the authorized commit and non-force push. The final commit SHA and remote synchronization will be reported after pushing.

The original audit below is retained as a historical record. Its cloud-hardening findings and production-testing limitations remain open; no Supabase setting, schema or financial data was changed for publication. Public source publication is not a claim that the application is production-certified.

## Original audit verdict (before publication approval)

The reviewed local application candidate contains no detected private credentials. Local fixes and verification pass. **Commit/push is not authorized or fully cleared:** the intended remote repository's privacy/history could not be verified, and user approval is required. Local Git index/history checks must be repeated after a real repository is available. The remaining findings below must be reviewed; this is not a production-security certification.

## Findings and fixes

| Priority | Finding | Status / action |
| --- | --- | --- |
| Gate | Neither the workspace root nor application root is a Git repository. No local index, tracked environment files or history can be inspected there. | `git rev-parse`, `git status` and cached-diff checks found no real repository. No staging/commit/history rewrite performed. |
| Gate | GitHub metadata lookup for the target returned 404 through the connected account. | Existence, visibility and remote history are unverified. A 404 can mean absent or inaccessible; do not infer that it is private or empty. Verify authorized access and private visibility before any push. |
| Fixed | `.env.example` contained a real project URL (public, not a secret). | Replaced with the two exact requested placeholders. `.env.local` kept its real local public configuration unchanged. |
| Fixed | No workspace-level ignore file; app ignores did not cover private receipt/export folders, browser evidence or audit caches. | Added root coverage and extended app ignores. Verified 38 ignored/allowed path cases with Git's actual matcher in an isolated ignored scratch repository. |
| Fixed | A future accidental private `VITE_` value could be embedded before runtime key checks execute. | Added pre-build/dev allowlisting and public-key/URL validation. Real production-build attempts with synthetic private-key and AI-key canaries failed without printing values. |
| Medium | Authenticated database role holds `TRUNCATE`, `TRIGGER`, `REFERENCES` as well as normal CRUD on all three tables. | Broader than this frontend needs. No SQL changed. Proposed least-privilege SQL below requires approval. `TRUNCATE` and `REFERENCES` are outside RLS; direct Data API exploitability was not demonstrated. No public-schema RPC functions/views were present in metadata. |
| Medium | Supabase security advisor reports leaked-password protection disabled. | Left unchanged as requested. Review [the official remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); feature availability depends on the plan. The frontend's six-character minimum does not prove strong server password policy. |
| Medium, code-review finding | In-flight mutations in `src/main.jsx` are not consistently bound to the current account before updating local UI state. | Account loading has a current-account guard, but mutation success handlers do not. A delayed response during logout/account switching could repopulate stale client state. RLS still governs the request. Add owner/version guards and a two-account delayed-response test before production; no live cross-account exploit was attempted. |
| Residual | Session tokens persist through supabase-js browser storage; signing links are short-lived bearer access; no deployment CSP was reviewed. | Preserve React escaping, prevent XSS and add appropriate hosting headers before deployment. No raw-HTML insertion or app credential/session logging was found. |

### Proposed database hardening — NOT APPLIED

Review existing database clients before approving. The current frontend only needs row-scoped SELECT, INSERT, UPDATE and DELETE:

```sql
revoke truncate, trigger, references
on table public.transactions, public.receipts, public.monthly_budgets
from authenticated;
```

This proposal removes privileges; it does not weaken RLS. Do not run it until approved. PostgreSQL documents that table-wide TRUNCATE/REFERENCES operations do not use row policies: [row security reference](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

## Secret and financial-file review

Initial workspace scan covered **2,913 UTF-8 text files**, including installed dependencies and generated assets, using credential-pattern matching and JWT payload classification. Twelve binary files were identified/skipped for text scanning. A final scan of 36 project/generated text files after the fixes also found no private credentials. Its single email-shaped match was a deliberately synthetic credential-bearing URL in `tests/public-env.test.js`, used to verify rejection; it is not an actual email/password. A follow-up assignment review checked project files for literal passwords, API secrets and access/refresh tokens. No private-key blocks, service-role/secret keys, privileged/session JWTs, provider keys, access tokens, credential-bearing database URLs or hardcoded secret assignments were detected.

Only the expected public publishable key was found, at `.env.local:2` and inside the ignored generated JavaScript bundle. Values are redacted and are not included in this report. [Supabase documents publishable keys as browser-safe when authorization is enforced](https://supabase.com/docs/guides/getting-started/api-keys); [Vite documents that VITE variables are embedded in browser code](https://vite.dev/guide/env-and-mode).

The only local document/image candidates were six UI-verification PNG screenshots with known synthetic test-data provenance. They are excluded by `.ui-verification/`. No real receipt image, financial export or database dump was identified. No actual user transaction/receipt contents were fetched from Supabase. Binary content was not OCR-scanned, and pattern matching cannot prove the absence of every possible secret or PII format.

## Live Supabase checks — read-only

- RLS enabled on `transactions`, `receipts`, `monthly_budgets`.
- Policies target `authenticated`, compare `auth.uid()` with `user_id`, and updates have both USING and WITH CHECK ownership predicates.
- `anon` and `authenticated` are neither superusers nor BYPASSRLS roles. No public-schema views or functions were reported.
- `anon` has no direct table grants for the three financial tables. Three API requests using the publishable key with **no user session** were denied with HTTP 401 / PostgreSQL code 42501; no financial rows were returned. The check's initial expected-zero-row classifier returned nonzero because permission denial is stronger than the originally expected empty response; the observed denial was reviewed as a successful negative-access check, not a data leak.
- Bucket `finflow-receipts` is private, with 10 MB maximum and JPEG/PNG/WEBP/PDF MIME allowlist. Storage INSERT/SELECT/DELETE policies require the bucket and first folder component to match the authenticated UUID. Upload uses random paths and no upsert. Signed access expires after 60 seconds.
- Frontend queries/inserts/updates/deletes use account identity and ownership predicates. Client filtering supplements rather than replaces RLS.
- No policy, grant, Auth configuration, storage configuration, schema or financial record was modified.

## Local files changed by this audit

- Workspace `.gitignore` and application `.gitignore`.
- Application `.env.example` (placeholders only; `.env.local` unchanged).
- `scripts/public-env.mjs`, `vite.config.js` and `tests/public-env.test.js`.
- `README.md`, `SECURITY.md`, this audit report and `docs/pre-commit-files.txt`.

No `src/` application file, dependency manifest/lockfile, real local environment value or cloud setting was changed.

## Executed verification

| Check | Result |
| --- | --- |
| `npm.cmd run build` in the app | Passed |
| `node --test` | 13 passed: 9 existing domain tests + 4 environment-guard tests |
| Production Vite build with synthetic private-key canary | Blocked before bundling; value absent from error |
| Production Vite build with synthetic unapproved AI VITE variable | Blocked before bundling; value absent from error |
| `npm.cmd audit --json --cache .npm-audit-cache --fetch-retries=0 --fetch-timeout=20000` | 0 known vulnerabilities across 124 resolved packages; no dependency updates performed |
| Git ignore matcher | 38 included/excluded cases passed; `.env.example` allowed, local env/dependencies/builds/private data ignored |
| Source/generated-asset credential scan | No private credentials detected; only expected public key locations |
| Live anonymous financial-table reads | All three denied; no data returned |
| Live RLS/storage/grant/advisor metadata | Reviewed; findings above |
| Exact proposed candidate review | `docs/pre-commit-files.txt` lists the application files intended for later approval; nothing staged |

Registry/API network checks required a sandbox exception; they were read-only. Initial restricted-network failures are not counted as passing results. The Supabase changelog markdown URL could not be rendered by the browsing tool; current official key/security documentation was consulted. No lint script is configured.

## Exact publication boundary

Use the application directory as the proposed repository root. Review `docs/pre-commit-files.txt`; it contains source, placeholders, tests, synthetic browser fixtures and documentation only. The parent's empty `package-lock.json`, `.ui-verification/`, `.security-audit/`, local environments, dependencies, npm cache and `dist/` are not part of that candidate. The root `.gitignore` additionally protects the outer workspace if it is ever used as a repository root; changing the chosen root requires reviewing that root's exact candidate again.

Synthetic browser fixtures are clearly labeled and never imported by application code. Do not stage real financial test data. The public project identifier in existing README links is not a secret; the example environment file itself now uses placeholders only.

## Remaining work before publication / production

1. Verify the target repository exists, is accessible to the correct account and is private. Audit any remote history before treating it as empty. Obtain user approval before repository creation, staging/committing or pushing.
2. Once the real Git index exists, verify tracked env files and scan the exact staged blobs and reachable history. Ignore files do not remove previously committed data. No automatic history rewrite is authorized.
3. Review the proposed database grant reduction and password-security setting separately; no cloud changes have been applied.
4. Fix/test mutation response isolation during account switches before production. Run two-account authenticated CRUD/storage/signed-URL tests without modifying existing financial records.
5. Plan deployment CSP/security headers, session behavior on shared devices, logging and monitoring. Native receipt content validation and orphan reconciliation remain backend work.
6. Keep future AI strictly behind the authenticated backend boundary in `SECURITY.md`. No provider call or secret has been added.

No exposed private credential was found, so no credential rotation is indicated by this scan alone. If any private credential is later discovered in current files, staging, history or artifacts, stop GitHub operations, revoke/rotate it first, investigate misuse, then obtain approval for an appropriate history/artifact cleanup plan. See `SECURITY.md` for the procedure.
