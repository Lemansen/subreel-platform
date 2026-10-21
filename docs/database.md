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

- video_sources supports HLS, DASH, MP4, and external embeds.
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
- `supabase/sql/017_profile_moderation.sql` adds moderator suspension fields, hides suspended profiles from public reads, prevents owners from re-enabling public visibility while suspended, and adds the `admin_set_profile_moderation` RPC. The RPC requires `app_metadata.role=catalog_admin`; profile moderation changes enter the protected audit log. This migration is prepared locally and still needs to be applied and checked against the remote project.

## Catalog audit log

- `supabase/sql/015_catalog_audit_log.sql` adds `public.catalog_audit_log`, an admin-readable, RLS-protected append-only log of INSERT/UPDATE/DELETE operations across catalog and source tables. `supabase/sql/016_catalog_audit_actor_index.sql` covers the actor foreign key.
- A trigger writes actor, entity/table, associated title (when present), timestamp, and before/after row snapshots. The trigger function lives in the non-exposed `private` schema; authenticated clients have SELECT only, while direct INSERT/UPDATE/DELETE is revoked.
- The project notes report migrations as applied to Supabase under `catalog_audit_log` and `catalog_audit_actor_index`, with RLS, admin-only SELECT, 12 triggers, and trigger insert/delete behavior verified. `/admin` shows the latest 100 events. The current session has no remote Supabase inspection capability, so the deployed state was not rechecked here.

## Administrator role management

- `supabase/sql/018_admin_role_management.sql` adds an RLS-protected record of role change attempts. Authenticated catalog admins may read it; only the server service role can write it.
- `/admin` can list users and grant/revoke `catalog_admin` in `app_metadata`. The server preserves existing app metadata, prevents changing the current administrator's own role, and refuses to remove the last catalog admin.
- Configure `SUPABASE_SERVICE_ROLE_KEY` as a server-only environment variable in local `.env.local` and the Vercel project. Do not prefix it with `NEXT_PUBLIC_` or expose it to client code. The regular catalog and profile actions continue to use the authenticated session.
- The feature is disabled until migration 018 is applied and the server key is configured. Refresh the target user's session (sign out/in) for the updated JWT role to take effect.
