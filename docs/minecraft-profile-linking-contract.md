# Minecraft profile linking contract

Status: design contract for the website and future SubReel Launcher integration. This document does not imply that the API or database migration is deployed.

## Invariants

- A SubReel ID may have multiple linked Minecraft Java profiles.
- A normalized Minecraft UUID may belong to at most one SubReel ID at a time.
- UUID normalization is case-insensitive and removes hyphens.
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

Migration `034_launcher_multiple_game_profiles.sql` prepares the primary key. It must not be applied to production until the launcher write path is compatible with the new key.

## Future trusted API boundary

Recommended server endpoints (names are proposals, not deployed routes):

### `POST /api/launcher/minecraft-profiles/link`

1. Require a valid SubReel access token and derive `user_id` from that token. Never accept `user_id` from the request body.
2. Require proof that the profile is a real Minecraft Java profile. Prefer validating a short-lived Minecraft access token against the official Minecraft profile endpoint on the server; do not trust only a client-supplied UUID/name.
3. Read the verified UUID and username from the verification response, normalize the UUID, then insert the association.
4. Do not use `upsert` on `user_id`: it could overwrite another profile belonging to the same SubReel ID.
5. On the global UUID unique-index conflict, return HTTP 409 with a stable code such as `MINECRAFT_PROFILE_ALREADY_LINKED`. Do not reveal which SubReel ID owns it.
6. Never log or persist Microsoft, Xbox, or Minecraft access tokens.

### `GET /api/launcher/minecraft-profiles`

Return only the authenticated SubReel ID's linked profiles:

```json
{
  "profiles": [
    {
      "minecraftUuid": "canonical-uuid",
      "minecraftUsername": "PlayerName",
      "linkedAt": "ISO-8601 timestamp"
    }
  ]
}
```

### `DELETE /api/launcher/minecraft-profiles/:minecraftUuid`

1. Derive `user_id` from the authenticated session.
2. Delete only the row matching both `user_id` and the normalized requested UUID.
3. Return success if the association was removed; never delete the local launcher account or its game session.
4. A profile linked to a different SubReel ID must not be affected.

## Error contract

Use stable machine-readable codes so the launcher can show friendly Russian messages:

- `UNAUTHENTICATED` — SubReel session is missing or expired.
- `MINECRAFT_PROFILE_UNVERIFIED` — profile ownership could not be verified.
- `OFFLINE_PROFILE_NOT_ALLOWED` — offline launcher profile attempted to link.
- `MINECRAFT_PROFILE_ALREADY_LINKED` — UUID is linked to another SubReel ID.
- `MINECRAFT_PROFILE_NOT_LINKED` — no matching association exists for this SubReel ID.
- `VALIDATION_ERROR` — malformed UUID or request.

## Website responsibilities

- Use the shared server helper in `src/lib/minecraft/linked-profiles.ts` for listing and checking links.
- Treat read failures as failures, not as proof that no profile is linked; UI may show a neutral unavailable state.
- Never implement linking by accepting a username/UUID form on the website.
- Show multiple linked profiles on the account page, and keep all profile data scoped to the signed-in SubReel ID.
- SubCoins and shop authorization must eventually check both the SubReel user and the specific Minecraft profile where an action is profile-specific.

## Launcher responsibilities (future work)

- Use the selected account's UUID for status refresh, link, and unlink operations.
- Allow linking only when Microsoft authentication and Minecraft Java profile verification succeeded.
- Do not unlink other profiles when changing the selected account.
- Handle HTTP 409 as a conflict, not as an instruction to replace the existing link.
- Keep local launcher account records and sessions separate from the server-side association.
