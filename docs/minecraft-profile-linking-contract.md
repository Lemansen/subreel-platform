# Minecraft profile linking contract

Status: the website branch contains the first server API implementation. It is not production-ready until the required environment secret is configured, migrations are applied in the correct order, and the launcher write path is updated.

## Invariants

- A SubReel ID may have multiple linked Minecraft Java profiles.
- A normalized Minecraft UUID may belong to at most one SubReel ID at a time.
- UUID normalization is case-insensitive and removes hyphens; the API stores lowercase UUIDs without hyphens.
- Unlinking removes only the association row. It must not delete the local launcher account, cached files, or the user's Microsoft/Minecraft session.
- Only a verified Minecraft Java profile may be linked. An offline-mode launcher profile is never eligible.
- The website displays only profiles linked to the currently authenticated SubReel ID. It must not accept a UUID or username from the browser as proof of ownership.

## Database model

Table: `public.launcher_game_profiles`

- `user_id`: SubReel Auth user UUID; foreign key to `auth.users(id)`.
- `minecraft_uuid`: canonical Minecraft Java profile UUID.
- `minecraft_username`: verified profile name returned by Minecraft services.
- `updated_at`: last successful link/update timestamp.

Constraints to keep:

- Primary key: `(user_id, minecraft_uuid)`, allowing multiple profiles per SubReel ID.
- Global unique index on `lower(replace(trim(minecraft_uuid), '-', ''))`, preventing the same Minecraft profile from being linked to two SubReel IDs.
- RLS must scope all user-visible reads to `auth.uid() = user_id`.
- After migration 035, direct `INSERT`, `UPDATE`, and `DELETE` from the authenticated Data API are revoked. Only the trusted server API can modify associations.

Apply database migrations in order only after the launcher write path is compatible:
1. `034_launcher_multiple_game_profiles.sql` — changes the primary key to support multiple profiles per user.
2. `035_secure_launcher_profile_writes.sql` — normalizes existing UUIDs and disables direct authenticated writes.

Do not apply these migrations to production yet: the existing launcher service may still upsert/delete by `user_id` and must be updated first.

## Website API implemented on the feature branch

All routes derive the SubReel user from the server-side Supabase session. They do not accept a user ID from the request body. Responses set `Cache-Control: no-store`.

### `GET /api/launcher/minecraft-profiles`

Returns only the current user's linked profiles:

```json
{
  "profiles": [
    {
      "minecraftUuid": "canonical-uuid-without-dashes",
      "minecraftUsername": "PlayerName",
      "linkedAt": "ISO-8601 timestamp"
    }
  ]
}
```

### `POST /api/launcher/minecraft-profiles`

Accepts a short-lived Minecraft access token in the JSON body:

```json
{ "minecraftAccessToken": "..." }
```

The server validates it against `https://api.minecraftservices.com/minecraft/profile`, uses only the UUID and username returned by Minecraft services, then inserts the association. It never logs or persists the access token. A duplicate UUID returns HTTP 409 `MINECRAFT_PROFILE_ALREADY_LINKED`; the response does not disclose which SubReel ID owns it.

The API requires `SUPABASE_SERVICE_ROLE_KEY` as a server-only environment variable. Never prefix it with `NEXT_PUBLIC_` or expose it to the browser.

### `DELETE /api/launcher/minecraft-profiles/:minecraftUuid`

Deletes only the row matching both the authenticated user's ID and the requested normalized UUID. It does not affect the local launcher account or game session. Returns `MINECRAFT_PROFILE_NOT_LINKED` if no association owned by the current user was removed.

## Error contract

- `UNAUTHENTICATED` — SubReel session is missing or expired.
- `MINECRAFT_PROFILE_UNVERIFIED` — Minecraft rejected the token or the returned profile was invalid.
- `MINECRAFT_VERIFICATION_UNAVAILABLE` — Minecraft profile service could not be reached or returned a transient failure.
- `MINECRAFT_PROFILE_ALREADY_LINKED` — UUID conflicts with an existing association.
- `MINECRAFT_PROFILE_NOT_LINKED` — no matching association exists for this SubReel ID.
- `VALIDATION_ERROR` — malformed request.
- `SERVER_CONFIGURATION_ERROR` — required server-side secret is missing.
- `PROFILE_LIST_FAILED`, `PROFILE_LINK_FAILED`, `PROFILE_UNLINK_FAILED` — generic server-side operation failures.

## Website responsibilities

- Use the shared helper in `src/lib/minecraft/linked-profiles.ts` for server-rendered profile lists and status checks.
- Treat read failures as failures, not as proof that no profile is linked; UI may show a neutral unavailable state.
- Never implement linking by accepting a username/UUID form on the website.
- Show multiple linked profiles on the account page, and keep all profile data scoped to the signed-in SubReel ID.
- SubCoins and shop authorization must eventually check both the SubReel user and the specific Minecraft profile where an action is profile-specific.

## Launcher responsibilities

- Use the selected account's UUID for status refresh, link, and unlink operations.
- Allow linking only when Microsoft authentication and Minecraft Java profile verification succeeded; send the short-lived Minecraft access token to the website API, not a client-supplied UUID/name.
- Do not unlink other profiles when changing the selected account.
- Handle HTTP 409 as a conflict, not as an instruction to replace the existing link.
- Keep local launcher account records and sessions separate from the server-side association.
- Update existing write operations to use these endpoints before applying migrations 034/035.
