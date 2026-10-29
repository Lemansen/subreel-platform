# CurseForge proxy for the launcher

The launcher must not contain the CurseForge API key. Add `CURSEFORGE_API_KEY` as a server-only environment variable in Vercel (Preview/Production as appropriate) and redeploy. Obtain the key through the CurseForge for Studios third-party developer application; approval and its API terms are required.

The route `src/app/api/launcher/curseforge/route.ts` accepts only the fixed catalog actions used by the launcher. Search accepts `type=modpack` (default, CurseForge class 4471) or `type=mod` (class 6). It accepts either a valid SubReel Supabase access token (`Authorization: Bearer …`, used by the launcher) or the signed-in website's Supabase session cookie. It limits requests per user and streams approved CurseForge CDN files while attaching the server-side key. It never accepts an arbitrary upstream URL. Anonymous requests still receive HTTP 401. Browser navigation should include an action such as `?action=search` to return catalog data.

The file CDN currently requires `x-api-key` on direct downloads. Do not copy this key into launcher settings, `appsettings.json`, or a client build.
