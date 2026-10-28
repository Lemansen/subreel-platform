const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

/** Reports launcher API configuration without returning environment values or secret material. */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const configuration = {
    publicNews: Boolean(supabaseUrl && publishableKey),
    launcherSignIn: Boolean(supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.LAUNCHER_AUTH_ENCRYPTION_KEY),
    curseForgeCatalog: Boolean(process.env.CURSEFORGE_API_KEY?.trim()),
    catalogTranslation: Boolean(process.env.DEEPL_AUTH_KEY?.trim()),
  };

  return Response.json(
    {
      service: "SubReel Launcher API",
      status: "ok",
      checkedAt: new Date().toISOString(),
      configuration,
    },
    { headers },
  );
}
