# CurseForge proxy for the launcher

The launcher must not contain the CurseForge API key. Add `CURSEFORGE_API_KEY` as a server-only environment variable in Vercel (Preview/Production as appropriate) and redeploy. Obtain the key through the CurseForge for Studios third-party developer application; approval and its API terms are required.

The route `src/app/api/launcher/curseforge/route.ts` accepts only the fixed catalog actions used by the launcher. It requires a valid SubReel Supabase access token, limits requests per user, and streams approved CurseForge CDN files while attaching the server-side key. It never accepts an arbitrary upstream URL.

The file CDN currently requires `x-api-key` on direct downloads. Do not copy this key into launcher settings, `appsettings.json`, or a client build.
