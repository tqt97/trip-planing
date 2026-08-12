# Audit v2.8.1

Full audit was run against the packaged v2.8.0 source before applying fixes.

## Fixed findings

1. Production shared Trip snapshots were still written to the same localStorage state key used by local mode. This could leave private/shared data cached on the browser. v2.8.1 disables state persistence in Supabase mode and clears legacy state-cache keys when production collaboration starts.
2. Replacing or deleting Place/Trip images left old Supabase Storage objects orphaned. v2.8.1 adds safe bucket-scoped cleanup for app-owned public Storage URLs and cleans newly uploaded files if a database save fails.
3. Place routing/API orchestration was extracted from `main.js` into `src/features/places/place-routing.js` to keep the main orchestrator under its quality budget.
4. Documentation/version drift was cleaned up and architecture documentation now reflects the v2.8 data model.

## Verified

- source/dist files match after build;
- CSS braces balanced;
- duplicate DOM ids: 0;
- unsafe direct optional `querySelector(...).addEventListener`: 0;
- runtime TODO/FIXME/HACK: 0;
- no real service-role/private credentials packaged;
- local and prod `/api/config` provider selection validated;
- reset SQL includes album/checklist-completion schema and Realtime setup.
