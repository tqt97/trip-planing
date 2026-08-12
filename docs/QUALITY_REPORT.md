# Quality Report — v2.9.8

## Automated gates

- Syntax/security lint: PASS
- Functional/API/repository/RLS/runtime-hygiene/error-UX tests: **62/62 PASS**
- UI responsive gate: PASS
- Performance budget: PASS
- Production build: PASS
- Smoke: PASS
- Monkey/fuzz: **2,000 mutations PASS**
- CSS `!important`: **0**

## Fixes verified in v2.9.8

- User-facing error messages no longer expose Trace IDs, HTTP codes or raw Supabase error messages.
- Technical error code/details remain available only inside Diagnostics logs for debugging.
- Expense pagination scrolls back to the top of the Expense section after a real page change.
- Image pagination uses the same scroll-to-section behavior.
- Pagination stays hidden when only one page exists.
- Service Worker cache is bumped to `dalat-planner-v2.9.8`.

## Runtime canary

Local runtime was started with `APP_ENV=local` and verified:

- `/` -> HTTP 200
- `/api/config` -> HTTP 200, `provider=localStorage`
- `/manifest.webmanifest` -> HTTP 200
- `/sw.js` -> HTTP 200

No live production Supabase credentials are available in the audit environment, so Google OAuth, live Postgres RLS and WebSocket delivery still require a two-account production smoke test after deployment.

## Performance

- CSS: **41,477 B**
- Browser JS tracked by UI gate: **112,013 B raw**
- Critical assets tracked by performance gate: **196,868 B raw**
- Gzip-equivalent: **55,023 B**

The error helper and Expense controller are included in the performance inventory.

## Security/data hygiene

- Supabase service/secret keys are not exposed by `/api/config`.
- Shared production Trip state is not persisted into local-mode localStorage state.
- Per-user checklist completions are protected by RLS.
- App-owned Storage images are cleaned when replaced/deleted.
- User-facing errors are sanitized before display.
- No `.env` / `.env.local`, service account file, `node_modules`, or `.git` is shipped in the release package.

## Build integrity

After the final build:

- `styles.css` matches `dist/styles.css` byte-for-byte.
- `index.html` matches `dist/index.html` byte-for-byte.
- `sw.js` matches `dist/sw.js` byte-for-byte.
- `manifest.webmanifest` matches its `dist/` copy byte-for-byte.
- CSS brace imbalance: 0.
- Duplicate DOM IDs: 0.
- Direct unsafe optional `querySelector(...).addEventListener`: 0.
- TODO/FIXME/HACK in runtime source: 0.
