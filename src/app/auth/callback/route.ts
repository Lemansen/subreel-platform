import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next");

  const next =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/account";

  if (!code) {
    console.error("[auth/callback] Authorization code is missing.");
    return NextResponse.redirect(
      new URL("/login?error=auth_callback", origin)
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error(
        "[auth/callback] Code exchange failed:",
        error.message
      );

      return NextResponse.redirect(
        new URL("/login?error=auth_callback", origin)
      );
    }

    return NextResponse.redirect(new URL(next, origin));
  } catch (error) {
    console.error("[auth/callback] Unexpected error:", error);

    return NextResponse.redirect(
      new URL("/login?error=auth_callback", origin)
    );
  }
}
