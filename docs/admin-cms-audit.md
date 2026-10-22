# CMS admin audit

Audit baseline: `main` at the start of branch `codex/admin-cms-audit` (2026-10-22).

Statuses describe repository code. They do not claim a live browser scenario or a write against production Supabase was run.

| Object | Current state in code | Remaining work |
| --- | --- | --- |
| Titles | Create/edit wizard, list/search/filter/pagination, preview, duplicate, publish/draft/archive, guarded delete. Admin actions check the JWT role. Delete preflights catalog and user-data dependencies and refuses non-empty titles. | Verify wizard save/reopen/publication in browser. Make dependency check and delete atomic to close the concurrent-write window. |
| Franchises | Create, edit all metadata and status, archive, and delete only when no title is attached. RLS admin policy and audit trigger exist. | Browser verification. |
| Genres | Create/edit name and slug, attach/detach title genres, and delete only when no title assignment exists. RLS admin policy and audit trigger exist. | Browser verification. |
| Title relationships | Create, edit type, and delete with confirmation. Duplicate/self-link validation, RLS admin policy and audit trigger exist. | Browser verification. |
| Seasons and episodes | Create/update/status. FK cascades from season to episodes and from episodes to video sources/progress. | Safe removal with dependency summary; ordering UX beyond episode sort-order editing. |
| Editions, volumes, chapters | Create/update/status. Edition/volume/chapter FKs cascade down to chapters and reading sources/progress. | Safe removal with dependency summary and confirmation. |
| Video and reading sources | Add and publish after rights confirmation; this branch adds metadata/URL/format/status edits and availability controls. Publishing on update requires fresh confirmation. Audit triggers already cover updates. | Browser verification; no hard-delete action is exposed. Consider a source health recheck workflow. |
| Users and roles | Profile moderation, role changes, last-admin guard, and separate role audit log are present. | Verify workflows against a real authorized session; external Auth API behavior cannot be proven from static code. |
| Catalog import | Import pages/actions and per-row retry/audit are present. | Inspect cancellation/retry edge cases and exercise using a disposable test job. |

## Security and data integrity notes

- Catalog Server Actions call an admin-role check; SQL policies in migrations `009`–`011` restrict catalog mutations to `app_metadata.role = catalog_admin`.
- Migration `015` adds an audit trigger for franchises, titles, relationships, genres, structure and sources. Later migrations extend audit coverage.
- Cascades in `001`, `005`, `012`, `019`, and `024` mean deleting titles or structural parents can remove source records, user progress, library entries, reviews, or import provenance. Existing title deletion blocks when it finds dependencies, but its preflight and delete are separate requests; make them atomic before expanding destructive operations.
- Title deletion now also blocks when `catalog_external_ids` import mappings exist, rather than silently cascading away those mappings.
- Structural deletion is intentionally not exposed yet. Add a transactional, dependency-aware database operation before adding UI buttons.
- Automated checks and live scenarios are recorded only after they actually run. Live Supabase/browser checks require a configured project and authenticated admin session.
- Several legacy admin lists are deliberately capped (`titles` 200 on the overview, structure rows 500–1000, sources 100, relationships 500). The dedicated title editor is paginated; the remaining management lists need search/pagination before they can safely handle a much larger catalog.

## Connected Supabase project check (2026-10-22)

- `subreel-platform` is `ACTIVE_HEALTHY`; catalog tables have RLS enabled and project migrations include the catalog/import migrations through `catalog_import_retry_atomic`.
- Security Advisor reports callable `SECURITY DEFINER` RPCs (`title_review_stats`, `admin_set_profile_moderation`, and two friendship/block helpers) and disabled leaked-password protection. These need review in a separate security pass; the warnings alone do not establish that each RPC is exploitable.
- Performance Advisor currently lists unused indexes and two tables with multiple permissive SELECT policies. The project is new/low volume, so no index or policy was changed based on that observation.

## Work completed on this branch

- Added in-place source editing for video and reading sources, including URL, format, provider, language, availability and publication state.
- Kept source rows auditable and avoided hard deletion. Switching a source to published requires explicit rights confirmation and writes a fresh review timestamp.
- Added relationship type editing and confirmed relationship deletion, plus full franchise and genre metadata editing. Franchise/genre deletes are blocked while parent records or assignments exist.
- Added section navigation anchors to the existing admin dashboard so the long page can jump to franchises, genres, relationships, structure, sources, moderation, roles and audit log.

## Checks run

- `npm run typecheck`: passed.
- `npm run lint`: passed with no errors; seven existing `@next/next/no-img-element` warnings remain in unrelated image-rendering files.
- `npm run build`: passed.
- Unauthenticated request to `/admin`: page output contains the Next.js redirect to `/login?next=%2Fadmin`; server-rendered redirects use a streamed response, so the HTTP status itself is 200.
- No create/update/delete was sent to the connected Supabase catalog, and no authenticated browser CRUD scenario was run.
- Added localized success messages and retained existing server-side admin authorization and database RLS.
