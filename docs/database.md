# Database model

## Existing catalog

The catalog remains centered on franchises and titles. A title can belong to zero or one franchise. Each title has one content_type and publication status.

## Video structure

- title_seasons belongs to a title.
- title_episodes belongs to a title and optionally a season. Composite foreign keys prevent an episode from pointing to a season of another title.
- Films and unseasoned works can have title-level video sources; episodic works can attach a source to an episode.

## Reading structure

- title_editions belongs to a title and distinguishes graphic and text editions, including language.
- title_volumes can belong to an edition or directly to a title.
- title_chapters can belong directly to a title, to an edition, or to a volume. A volume requires an edition. Composite foreign keys keep each level within the same title.

## Sources and access

- video_sources supports HLS, DASH, MP4, and external embeds. Embed playback currently accepts HTTPS URLs from YouTube NoCookie, Vimeo Player, and RuTube's `/play/embed/{32-character-id}` route.
- reading_sources supports image pages, PDF, EPUB, HTML, and plain text.
- Both source tables default to pending rights, pending availability, and draft publication. Published rows require approved rights and a review timestamp. Source URLs must use HTTPS.
- Anonymous clients have SELECT only. Authenticated clients have SELECT/INSERT/UPDATE/DELETE grants; RLS permits writes only for JWT app_metadata.role = catalog_admin. Public SELECT policies expose published catalog data and approved, published, available sources; catalog admins can inspect drafts. No TRUNCATE grant is issued.
- The web app uses the authenticated session and does not use a service-role key. The admin form stores a human rights attestation; it does not verify a license. Reviewer identity/audit trail and automated rights verification remain future work.

## Migrations and verification

- supabase/sql/005_media_structure_and_sources.sql adds content units, sources, constraints, RLS, policies, and grants.
- supabase/sql/006_media_structure_fk_indexes.sql adds indexes for composite foreign keys reported by the database advisor.
- Applied to Supabase project gyzpqqimgqflajztkvmy on 2026-10-21. The project migration history records media_structure_and_approved_sources and media_structure_fk_indexes.
- Verification confirmed all twelve catalog/source tables have RLS enabled, one SELECT policy and three separate admin write policies. anon has SELECT; authenticated has CRUD grants constrained by RLS. Supabase performance advisor reports no remaining unindexed foreign keys. Its unused-index notices are expected for a newly created, still-empty content schema.

- supabase/sql/007_published_parent_visibility.sql tightens RLS so a published child remains hidden when its season, edition, or volume is unpublished.

## Admin access and migrations 008–011

- 008 revokes default broad privileges on media/source tables and grants public read only.
- 009 grants authenticated CRUD and adds catalog_admin RLS policies across catalog/source tables.
- 010 makes JWT role evaluation init-plan friendly.
- 011 combines public/admin SELECT predicates and separates admin INSERT/UPDATE/DELETE policies.
- To grant access, add role=catalog_admin to the trusted user's app_metadata in Supabase Dashboard while preserving existing metadata. Refresh the session (sign out/in). Users cannot set app_metadata themselves. Unauthorized users cannot access /admin.
- Migration 011: supabase/sql/011_merge_public_admin_select_policies.sql; applied 2026-10-21. The migration history in Supabase includes migrations 008–011. Local SQL files exist, but a canonical Supabase CLI migration folder/history is still not established.
- Read-only Supabase MCP inspection on 2026-10-22 found 21 entries in the remote migration history, while the repository has 27 numbered `supabase/sql/*.sql` files. Candidate mapping: local 001–003 align by order with the first three remote entries (names differ and their SQL has not been content-diffed); local 005–016 and 022–027 align with remote entries by migration names. No remote history entries correspond to local 004 and 017–021, although their associated schema is present. Do not reapply those SQL files or assume a blank-project replay until the migration history is reconciled. Supabase CLI is not installed in the current environment.

## Personal library and progress

- `user_library` stores each user's private status and favorite flag per title.
- `video_progress` stores playback seconds per title or episode. `reading_progress` stores the selected chapter, optional page fields, and completion timestamp.
- All three tables have RLS policies using `(select auth.uid()) = user_id`, four policies (select/insert/update/delete), authenticated CRUD grants, no anon access, and no TRUNCATE privilege.
- The generated `unit_id` makes title-level and episode/chapter-level progress upserts unique while foreign keys ensure each unit belongs to its title.
- Migrations `supabase/sql/012_library_and_progress.sql` and `supabase/sql/013_progress_fk_indexes.sql` applied to Supabase on 2026-10-21 as `library_and_progress` and `progress_fk_indexes`. The performance advisor reports no unindexed foreign keys; unused-index notices are expected until these tables have data. The project currently has no published titles, so content-backed behavior remains to be manually checked after a permitted title/source is added.

## Public profile visibility

- `profiles.is_public` is opt-in and defaults to `false`. Migration `supabase/sql/014_public_profile_visibility.sql` (remote version `20261021185502`, `public_profile_visibility`) was applied to Supabase on 2026-10-21.
- A profile owner can always read and update their own row. Signed-in visitors can read public rows; anonymous visitors can read only rows with `is_public = true`. The account's library and progress tables keep their existing owner-only policies.
- `/account` contains the visibility toggle, and `/u/[username]` displays only the profile's display name, username, avatar, and bio. Cross-account browser/RLS verification is still outstanding.
- `supabase/sql/017_profile_moderation.sql` adds moderator suspension fields, hides suspended profiles from public reads, prevents owners from re-enabling public visibility while suspended, and adds the `admin_set_profile_moderation` RPC. The RPC requires `app_metadata.role=catalog_admin`; profile moderation changes enter the protected audit log. Read-only REST checks on 2026-10-21 confirmed the moderation columns are present remotely; Supabase migration history was not available to inspect.

## Catalog audit log

- `supabase/sql/015_catalog_audit_log.sql` adds `public.catalog_audit_log`, an admin-readable, RLS-protected append-only log of INSERT/UPDATE/DELETE operations across catalog and source tables. `supabase/sql/016_catalog_audit_actor_index.sql` covers the actor foreign key.
- A trigger writes actor, entity/table, associated title (when present), timestamp, and before/after row snapshots. The trigger function lives in the non-exposed `private` schema; authenticated clients have SELECT only, while direct INSERT/UPDATE/DELETE is revoked.
- The project notes report migrations as applied to Supabase under `catalog_audit_log` and `catalog_audit_actor_index`, with RLS, admin-only SELECT, 12 triggers, and trigger insert/delete behavior verified. `/admin` shows the latest 100 events. The current session has no remote Supabase inspection capability, so the deployed state was not rechecked here.

## Administrator role management

- `supabase/sql/018_admin_role_management.sql` adds an RLS-protected record of role change attempts. Authenticated catalog admins may read it; only the server service role can write it.
- `/admin` can list users and grant/revoke `catalog_admin` in `app_metadata`. The server preserves existing app metadata, prevents changing the current administrator's own role, and refuses to remove the last catalog admin.
- Configure `SUPABASE_SERVICE_ROLE_KEY` as a server-only environment variable in local `.env.local` and the Vercel project. Do not prefix it with `NEXT_PUBLIC_` or expose it to client code. The regular catalog and profile actions continue to use the authenticated session.
- Read-only REST checks on 2026-10-21 confirmed the role audit table and its expected columns are present remotely. The local `.env.local` contains the server key variable; Vercel configuration and role-change execution were not checked. Refresh the target user's session (sign out/in) for the updated JWT role to take effect.

## Title ratings and reviews

- `supabase/sql/019_title_reviews.sql` adds one 1–10 rating/review per user and published title. The text is limited to 3000 characters; owners can edit or delete their own entry.
- Reviews and ratings are private by default. A review appears publicly only when its owner opts in and has an enabled public profile. Suspended or private profiles are excluded; public names are shown only for public profiles, otherwise the reviewer is anonymous.
- The `title_review_stats` RPC returns only the public average and count. Read-only checks confirmed the review fields and RPC are exposed by the remote project; RLS row behavior was not tested with a signed-in user session.
- Apply migration 017 before 019 in new environments because review policies and rating aggregates exclude suspended profiles. Migration 018 is independent.

## Private library statistics

- `supabase/sql/020_user_library_stats.sql` adds `user_library_stats()`, a `SECURITY INVOKER` RPC that returns exact library-status, favorite, video-position, and reading-position counts for `auth.uid()` only. Execution is granted only to `authenticated`; the underlying tables retain owner-only RLS.
- `/account/library` displays these counters separately from its recent-item lists. The remote REST API confirms the function is present; account-scoped results were not queried because no authenticated user session was used for the check.

## Friend requests and blocks

- `supabase/sql/021_friendships.sql` defines private `friend_requests` and `user_blocks` tables. Requests are visible only to the two participants; only the recipient can accept/reject a pending request, and either participant can remove a request or friendship.
- New requests require the target to have an enabled, non-suspended public profile and are rejected if either participant has blocked the other. Column-level grants prevent changing request participants or block ownership.
- Migration 021 was applied remotely by the user on 2026-10-22. Read-only REST checks confirmed both tables and helper functions exist; anonymous requests to both tables and functions returned HTTP 401. Authenticated row-level behavior still needs a two-account session check.

## User reports and moderation appeals

- `supabase/sql/022_user_reports_and_appeals.sql` adds authenticated reports for published titles and public profiles, plus appeals for users whose profiles were restricted by moderation.
- Reporters can read only their own reports; catalog admins can review all reports and update moderation decisions. Users can read their own appeals; only admins can decide them. RLS validates that report targets are publicly visible and that appeal submitters have an active profile restriction.
- Partial unique indexes prevent duplicate active reports from the same reporter for the same target and duplicate open appeals per user. Reports and appeals are captured in the admin-only catalog audit log. The UI is implemented at `/admin/reports`; public title/profile pages accept reports and `/account` exposes the appeal form when restricted.
- Migrations 022 and 023 were applied remotely on 2026-10-22. Read-only checks confirmed both tables have RLS enabled, all six expected select/insert/update policies are installed, audit triggers are attached, and the audit-log table constraint accepts both entity types. Performance Advisor reports no remaining unindexed foreign keys; the new indexes appear unused while the report tables are empty. Authenticated row-level behavior remains to be tested with user and admin sessions.

## Catalog JSON imports

- `supabase/sql/024_catalog_import.sql` defines external provider IDs, import job summaries, and per-row errors. Policies restrict access to users whose trusted `app_metadata.role` is `catalog_admin`; anon has no grants. Indexes cover title/job/actor foreign keys and recent job listing.
- `/admin/import` accepts a JSON package with up to 100 titles (1 MB), previews slug/external-ID matches, creates drafts, and fills only empty descriptive metadata on existing titles. The first source adapter searches public AniList anime/manga metadata server-side and adds selected results to the JSON package; it does not publish automatically. Import runs are recorded and row failures shown in the admin UI. Migration 024 was applied to Supabase on 2026-10-22. Read-only verification confirmed RLS and one catalog-admin policy on each table, no anon SELECT privileges, and no import-specific security/performance advisor finding beyond unused indexes on empty tables. Additional provider adapters and rights verification remain future work.
- Migration `025_catalog_import_retry_payload.sql` adds a nullable JSONB payload to import errors; only rows that passed server-side validation are stored there. Admins can retry those rows from the import log; malformed input must be corrected and uploaded again. Migration 025 was applied to Supabase on 2026-10-22; read-only verification confirmed RLS remains enabled on the error table. Existing Security Advisor warnings concern other pre-existing functions and leaked-password protection.
- `/admin/import` can refresh an existing AniList-linked title by external ID. The server re-fetches AniList data for both preview and save, verifies the catalog-admin role and exact provider mapping, and accepts only explicitly selected descriptive fields. It never changes slug, content type, publication state, or content structure; the existing `titles` admin RLS policy protects the database update, so this needs no new migration.
- Import preview performs a bounded, normalized-name search for possible title duplicates and lists up to three candidates per new row. Any candidates require explicit admin acknowledgement; the server repeats the check before writing and fails closed if the candidate search errors. This is heuristic and can miss duplicates, especially across different transliterations or aliases.
- Migration `026_catalog_import_queue.sql` adds a validated JSONB package, next-row cursor, status values (`queued`/`running` included), and a short processing lease to import jobs. The admin server action claims jobs conditionally, processes five rows at a time, and persists counters after each row so interrupted jobs can resume without starting over. RLS remains the existing `catalog_admin` policy; the migration is applied remotely. Queue execution currently advances while the admin page is open or after an admin resumes it; no cron/worker runs unattended yet.
- The admin import journal filters by status and source label, paginates 20 jobs per server query with an exact count, resolves each actor's display name, and lazy-loads up to 100 row errors only when expanded. This avoids loading every error record for all recent jobs on each page render.
- Row processing stores only known, user-safe error messages; unexpected exception details stay in server logs. If an error row cannot be persisted, the job cursor does not advance and the job is released back to the queue (or becomes claimable when its lease expires), preventing an unrecorded row failure from being silently skipped.
- Migration `027_catalog_import_retry_atomic.sql` adds a five-minute retry claim and an invoker-rights function that deletes the source error and updates the source job counters in one transaction. Function execution is revoked from `anon`/`public` and granted to `authenticated`; table RLS still restricts actual access to catalog admins. Applied remotely and checked that error-table RLS remains enabled, the function is invoker-rights, anon cannot execute it, and authenticated can.
- The existing title wizard now reads `catalog_external_ids` for an edited title and displays provider, external ID, and source link. It continues updating the existing title row; source mappings are left intact. A provenance query failure is shown separately and does not prevent editing.
- Import source URL and associated image hosts are checked server-side against exact provider allowlists (AniList, TMDB, Open Library). Custom providers require the optional exact-host environment allowlists `CATALOG_IMPORT_ALLOWED_CUSTOM_SOURCE_HOSTS` and `CATALOG_IMPORT_ALLOWED_CUSTOM_MEDIA_HOSTS`, which default to empty. This verifies URL origin only; it is not proof of media licensing or redistribution rights.
- `/admin/import/report` exports an admin-only CSV with total counters and per-job rows, optionally filtered by UTC start/end date, capped at 100,000 rows. Text cells are escaped against spreadsheet formula execution and responses are private/no-store; the export uses the existing RLS-protected job table and requires no schema change.
- `vercel.json` schedules `/api/cron/catalog-import` daily at 05:00 UTC. The endpoint requires Vercel's `Authorization: Bearer CRON_SECRET`, uses the server-only Supabase service-role client to select one oldest queued or expired-lease job, and processes up to 12 queue batches per invocation. Each batch still uses the existing conditional lease claim. Set a random `CRON_SECRET` and server-only `SUPABASE_SERVICE_ROLE_KEY` in Vercel before relying on the worker; Vercel cron runs only on production deployments. Daily cadence is compatible with Hobby's once-per-day limit.
- The TMDB picker uses the server-side `TMDB_API_READ_ACCESS_TOKEN` environment variable (API Read Access Token/Bearer). Add it to local `.env.local` and Vercel → Project Settings → Environment Variables; never expose it as `NEXT_PUBLIC_*`. The public About section contains TMDB's required logo and disclaimer. TMDB's API is free for non-commercial use with attribution; commercial use requires confirming a suitable license with TMDB. No TMDB token was present in the current environment, so live authenticated search remains unverified.

## Migration history reconciliation audit — 2026-10-22

- Read-only `supabase_list_migrations` and `select version, name from supabase_migrations.schema_migrations order by version` agree: the remote database records 21 versions. No remote records match local SQL files 004 or 017–021. Read-only catalog checks confirm the profile-privacy, moderation, admin-role-audit, reviews, private-library-stats, and friendship objects those scripts define are present. This confirms those effects exist, but cannot establish exactly which script or manual SQL produced them.
- The first three remote migration names (`restrict_catalog_table_privileges`, `restrict_profiles_to_owner`, `restore_profile_and_updated_at_triggers`) do not match local files 001–003 by name; their exact source SQL is not available in the repository. Local 005–016 and 022–027 have remote entries with matching migration names, but their byte-for-byte provenance is not established.
- `npx supabase --version` reports 2.121.0. `npx supabase migration list --project-ref gyzpqqimgqflajztkvmy` cannot authenticate because this environment has no `SUPABASE_ACCESS_TOKEN`; this repository also has no `supabase/migrations` directory. Keep using the documented `supabase/sql` sequence for new environment setup, and do not run `db push` or edit remote migration history directly until a canonical timestamped history and exact mapping are established.
- Supabase's [migration deployment guide](https://supabase.com/docs/guides/deployment/database-migrations) describes `migration repair` as a history reconciliation operation, distinct from applying or reverting schema SQL. After an authenticated CLI is available, first create and review the local timestamped history, then use the CLI repair workflow only for versions whose effects have been verified; finish with `supabase migration list` and a clean local replay.
