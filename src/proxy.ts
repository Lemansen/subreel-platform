import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Обновляет сессию Supabase на каждом запросе страницы:
 * проверяет токен и, если он истёк, записывает обновлённые cookie
 * и в запрос (для серверных компонентов), и в ответ (для браузера).
 *
 * Здесь НЕ делаем редиректов и проверок доступа — только обновление сессии.
 * Защиту страниц нужно проверять рядом с данными (серверные компоненты/RLS).
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Без настроек Supabase сайт не должен падать целиком.
  if (!url || !key) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );

        // Заголовки против кеширования ответов с Set-Cookie (CDN).
        Object.entries(headers ?? {}).forEach(([name, value]) =>
          response.headers.set(name, value)
        );
      },
    },
  });

  try {
    // Не добавляйте код между createServerClient и getClaims():
    // это запускает проверку/обновление токена.
    await supabase.auth.getClaims();
  } catch (error) {
    console.error("[proxy] Supabase session refresh failed:", error);
  }

  return response;
}

export const config = {
  matcher: [
    // Все пути, кроме статики, оптимизации изображений и файлов-ресурсов.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
