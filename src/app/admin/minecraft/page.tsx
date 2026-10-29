import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const instant = false;

type Props = { searchParams: Promise<{ q?: string }> };
type LinkedProfile = {
  user_id: string;
  minecraft_uuid: string;
  minecraft_username: string;
  updated_at: string;
};

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

export default async function AdminMinecraftPage({ searchParams }: Props) {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect("/login?next=%2Fadmin%2Fminecraft");
  if (user.app_metadata?.role !== "catalog_admin") redirect("/");

  const query = (await searchParams).q?.trim().toLowerCase() ?? "";
  const admin = createSupabaseAdminClient();

  let profiles: LinkedProfile[] = [];
  let loadError = false;
  if (!admin) {
    loadError = true;
  } else {
    const result = await admin
      .from("launcher_game_profiles")
      .select("user_id,minecraft_uuid,minecraft_username,updated_at")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (result.error) {
      console.error("[admin-minecraft] Failed to load linked profiles:", result.error.code);
      loadError = true;
    } else {
      profiles = (result.data ?? []) as LinkedProfile[];
    }
  }

  const filtered = query
    ? profiles.filter((profile) =>
        profile.minecraft_username.toLowerCase().includes(query) ||
        profile.minecraft_uuid.toLowerCase().includes(query.replace(/-/g, "")) ||
        profile.user_id.toLowerCase().includes(query)
      )
    : profiles;

  return <>
    <SiteHeader />
    <main className="mx-auto min-h-screen max-w-6xl space-y-8 px-4 py-6 text-white sm:px-6 sm:py-10">
      <section className="overflow-hidden rounded-3xl border border-violet-400/20 bg-[radial-gradient(ellipse_at_top_right,rgba(124,58,237,0.22),transparent_55%),linear-gradient(135deg,rgba(30,27,75,0.45),rgba(17,17,25,0.95))] p-5 sm:p-8">
        <Link href="/admin" className="text-sm text-violet-300 hover:text-violet-200">← Админ-панель</Link>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">SubReel · Minecraft</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Minecraft-профили</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">Просмотр привязок Minecraft Java к SubReel ID. Здесь отображаются только подтверждённые профили; токены Microsoft/Minecraft не сохраняются и не выводятся.</p>
          </div>
          <Link href="/admin/launcher-releases" className="rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-violet-200 hover:bg-white/5">Релизы лаунчера →</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-zinc-400">Загружено привязок</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{profiles.length}</p>
          <p className="mt-1 text-xs text-zinc-500">Максимум 500 последних записей</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-zinc-400">Уникальных SubReel ID</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{new Set(profiles.map((profile) => profile.user_id)).size}</p>
          <p className="mt-1 text-xs text-zinc-500">В пределах загруженной выборки</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-zinc-400">Результаты поиска</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{filtered.length}</p>
          <p className="mt-1 text-xs text-zinc-500">По нику, UUID или ID владельца</p>
        </article>
      </section>

      {loadError && <p role="alert" className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">Не удалось загрузить привязки. Проверь SUPABASE_SERVICE_ROLE_KEY и наличие таблицы launcher_game_profiles. Подробности ошибки не раскрываются в интерфейсе.</p>}

      <form action="/admin/minecraft" method="get" className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row">
        <label className="sr-only" htmlFor="minecraft-profile-query">Поиск профилей</label>
        <input id="minecraft-profile-query" name="q" defaultValue={query} placeholder="Ник Minecraft, UUID или SubReel ID" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400" />
        <button className="rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold hover:bg-violet-400">Найти</button>
        {query && <Link href="/admin/minecraft" className="rounded-xl border border-white/10 px-4 py-2.5 text-center text-sm text-zinc-300 hover:bg-white/5">Сбросить</Link>}
      </form>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="border-b border-white/10 px-4 py-4 sm:px-5">
          <h2 className="font-semibold">Привязанные аккаунты</h2>
          <p className="mt-1 text-xs text-zinc-500">Показаны последние 500 записей. UUID и ID владельца сокращены в таблице.</p>
        </div>
        {loadError ? null : filtered.length === 0 ? (
          <p className="p-6 text-sm text-zinc-400">{query ? "Ничего не найдено." : "Пока нет привязанных Minecraft-профилей."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
                <tr><th className="px-5 py-3 font-medium">Minecraft</th><th className="px-5 py-3 font-medium">UUID</th><th className="px-5 py-3 font-medium">SubReel ID</th><th className="px-5 py-3 font-medium">Обновлено</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filtered.map((profile) => (
                  <tr key={profile.minecraft_uuid} className="hover:bg-white/[0.025]">
                    <td className="px-5 py-4"><span className="font-semibold">{profile.minecraft_username}</span><p className="mt-1 text-xs text-zinc-500">Minecraft Java Edition</p></td>
                    <td className="px-5 py-4 font-mono text-xs text-zinc-300" title={profile.minecraft_uuid}>{shortId(profile.minecraft_uuid)}</td>
                    <td className="px-5 py-4 font-mono text-xs text-zinc-300" title={profile.user_id}>{shortId(profile.user_id)}</td>
                    <td className="px-5 py-4 text-xs text-zinc-400">{profile.updated_at ? new Date(profile.updated_at).toLocaleString("ru-RU") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-xs leading-5 text-zinc-500">Раздел работает только на чтение: администратор не может отсюда присвоить чужой аккаунт, удалить привязку или менять баланс. Для безопасного управления связями сначала нужен отдельный серверный сценарий с подтверждением и журналом действий.</p>
    </main>
  </>;
}
