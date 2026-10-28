# SubReel Launcher browser sign-in

The launcher authorization endpoints use a short-lived request, PKCE, a state value, and a one-time callback to a loopback listener. Supabase access and refresh tokens are encrypted at rest by the platform and returned only by the one-time exchange endpoint. The browser redirect contains only the one-time code and state.

## Deployment setup

1. Migration `launcher_auth_handoff_031` was applied to the production Supabase project on 2026-10-27 (`20261027142033`). It creates/ensures the short-lived request and rate-limit tables and service-role-only RPC functions. The launcher request tables are intentionally inaccessible to `anon` and `authenticated` and have no RLS policies; RLS is enabled and there are no grants for those roles.
2. Add `LAUNCHER_AUTH_ENCRYPTION_KEY` to the platform server environment. Generate a fresh 32-byte key with PowerShell:

   ```powershell
   $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
   $bytes = New-Object byte[] 32
   $rng.GetBytes($bytes)
   [Convert]::ToBase64String($bytes)
   $rng.Dispose()
   ```

   Keep the same value across deployments and backups. Never place it in `.env.example`, client-side variables, or the launcher.
3. Confirm the platform server has `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the Supabase SSR cookie configuration already used by the site. The service-role key remains server-only.
4. Configure the launcher website base URL (currently `https://www.subreel.ru`) and the public Supabase URL/key. The launcher must use a local loopback callback listener and keep the PKCE verifier locally until exchange.
5. Test expired requests, cancellation, duplicate approval/exchange, wrong state, wrong verifier, signed-out and signed-in browsers, and recovery after network failure before enabling for users.

Without the migration and encryption key, endpoints return a service-unavailable response. Do not mark production SSO complete until deployment settings and the launcher client have been verified together.
