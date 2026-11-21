# Code standards

## Current reality

The existing code is dense, minified-style JavaScript: many statements per line and very long JSX lines. No ESLint or Prettier is configured. Reformatting is **planned** (roadmap Stage 1) but needs approval. Until then, match the surrounding style in small fixes, and don't mix a mass reformat with behaviour changes.

## Rules for new or changed code

- **Language:** plain JavaScript ESM (`.js` logic, `.jsx` components). Adopting TypeScript would be a separate, approved decision.
- **Layering:** pure logic (`transactions.js`, `warranties.js`) ↔ data access (`data.js`, `warranty-data.js`) ↔ UI. Put calculations and validation in the pure modules so they can be unit tested.
- **Money:** always use integer cents through `cents()`. Never sum floating-point amounts. Values sent to the database are fixed to 2 decimals.
- **Dates:** calendar strings `YYYY-MM-DD`. Use `today()` (local date) and `dateParts`/`calculateExpiration`. Avoid `new Date(string)` timezone math.
- **Account safety:** every async handler must:
  1. call `scope.assert()` before the write;
  2. check `scope.current()` before any `setState` that runs after an `await`;
  3. take the `saving.current` / `lock.current` lock to block double submits.
- **Ownership:** data calls include `.eq('user_id', userId)` and inserts set `user_id`. Never trust a client-supplied owner for authorization; RLS does that.
- **Client writes:** send only columns the user may write. Never send `expiration_date`, `id`, timestamps or `storage_path` edits.
- **Validation in two places:** frontend validation mirrors the database CHECK constraints. Keep both in sync when either changes.
- **Errors:** user-facing messages say what was saved and what wasn't, and offer a safe retry. Never repeat a financial write when retrying.
- **Rendering:** rely on React escaping. Never use `dangerouslySetInnerHTML` with receipt or OCR text. No `console.*` with user data, tokens or signed URLs.
- **CSS:** use tokens from `tokens.css`. Scope new feature CSS in its own file, the way `warranties.css` does. Mobile-first checks at 320, 375, 430, 768, 1024 and 1440px.
- **Accessibility:** labelled inputs, status/alert roles, 44px targets, visible focus, reduced motion.

## Database changes

Each schema change gets a file in `supabase/migrations/` (timestamped). It must include RLS policies, explicit least-privilege grants (revoke defaults first), and constraints that mirror frontend validation. Add isolated PGlite checks to `scripts/verify-*-db.mjs`. A migration is applied only with explicit approval.

## Testing

| Command | What it covers |
|---|---|
| `npm test` | node:test unit tests in `tests/` (32 passing on 2026-11-21) |
| `npm run test:db` | Isolated PGlite SQL and RLS checks (12 passing). Needs `.ui-verification/warranty-db` installed. |
| `npm run test:ui`, `npm run test:warranty-ui` | Edge headless with a fake Supabase. Needs `npm run dev -- --port 5178`. Writes to `../.ui-verification`. |
| `npm run build` | Production bundle (passing) |
| `npm audit` | 0 vulnerabilities |

Add tests alongside new logic: pure functions → `tests/`; data services → inject a fake client (see `tests/warranty-data.test.js`).

## Git conventions

Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). Branch off `main` for features. Review staged file names and scan for secrets before every commit. Committing and pushing always need approval.
