# Launcher catalog translations

The launcher sends catalog text to `POST /api/launcher/translate` with the current SubReel Supabase access token. The route validates the session, limits each account to 20 requests per minute, caps each request at 50 strings and 30,000 characters, and keeps the DeepL credential on the server.

Configure `DEEPL_AUTH_KEY` as a server-only variable in Vercel and redeploy. DeepL Free is used by default; set `DEEPL_API_URL=https://api.deepl.com` for a Pro key. Never expose the key through a `NEXT_PUBLIC_*` variable or the launcher.

The endpoint does not persist translated text or request bodies. The launcher keeps a bounded local cache so it does not request the same text and language repeatedly. Translation requires a valid SubReel account session.
