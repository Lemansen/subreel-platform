import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createRelease, setReleaseStatus, updateRelease } from "./actions";

// The admin page reads the signed-in user's session and database data per request.
export const instant = false;

type Props={searchParams:Promise<{error?:string;success?:string}>};
const input="w-full rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400";
const label="mb-1.5 block text-sm text-zinc-300";
const releaseErrors: Record<string,string> = {
 "invalid-release": "Проверь обязательные поля и ссылку на релиз SubReel Launcher.",
 "invalid-release-url": "Укажи ссылку на тег релиза репозитория SBUnivers/SubReel.Launcher.",
 "github-release-not-found": "Такого GitHub Release нет. Сначала создай релиз на GitHub.",
 "github-release-is-draft": "GitHub Release пока черновик. Опубликуй его на GitHub перед публикацией новости.",
 "github-channel-mismatch": "Канал на сайте не совпадает с типом GitHub Release (stable/prerelease).",
 "github-release-mismatch": "GitHub API вернул другой тег или ссылку релиза.",
 "github-version-mismatch": "Версия новости должна совпадать с тегом GitHub Release (допускается префикс v).",
 "github-check-unavailable": "Не удалось проверить GitHub Release. Повтори попытку позже.",
 "version-exists": "Эта версия уже добавлена.",
 "save-failed": "Не удалось сохранить запись. Проверь подключение и права доступа.",
};
export default async function LauncherReleasesPage({searchParams}:Props){
 const db=await createClient(); const {data:{user},error}=await db.auth.getUser();
 if(error||!user)redirect("/login?next=%2Fadmin%2Flauncher-releases");
 if(user.app_metadata?.role!=="catalog_admin")redirect("/");
 const query=await searchParams;
 const {data:releases}=await db.from("launcher_releases").select("id,version,channel,news_tag,cover_url,title,summary,change_notes,status,github_release_url,published_at,created_at").order("created_at",{ascending:false}).limit(100);
 return <main className="mx-auto max-w-6xl space-y-8 p-6 text-white sm:p-10">
  <div><Link href="/admin" className="text-sm text-violet-300 hover:text-violet-200">← Админ-панель</Link><h1 className="mt-4 text-3xl font-bold">Релизы лаунчера</h1><p className="mt-2 text-sm text-zinc-400">Одна публикация появляется на сайте и во вкладке новостей лаунчера.</p></div>
  {query.error&&<p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm">{releaseErrors[query.error]??"Не удалось выполнить действие с релизом."}</p>}
  {query.success&&<p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm">Изменения сохранены.</p>}
  <form action={createRelease} className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:grid-cols-2">
   <label><span className={label}>Версия (например 0.2.0)</span><input name="version" required maxLength={64} className={input}/></label>
   <label><span className={label}>Канал</span><select name="channel" className={input}><option value="stable">Стабильный</option><option value="beta">Бета</option></select></label>
   <label><span className={label}>Тип новости</span><select name="news_tag" className={input}><option value="launcher">Лаунчер</option><option value="server">Сервер</option><option value="event">Событие</option></select></label>
   <label><span className={label}>HTTPS-ссылка на обложку (необязательно)</span><input name="cover_url" type="url" placeholder="https://…" className={input}/></label>
   <label className="md:col-span-2"><span className={label}>Заголовок новости</span><input name="title" required maxLength={160} className={input}/></label>
   <label className="md:col-span-2"><span className={label}>Описание обновления</span><textarea name="summary" required maxLength={2000} rows={3} className={input}/></label>
   <label className="md:col-span-2"><span className={label}>Список изменений (каждый пункт с новой строки)</span><textarea name="change_notes" rows={5} className={input}/></label>
   <label className="md:col-span-2"><span className={label}>Ссылка на тег GitHub Release</span><input name="github_release_url" type="url" placeholder="https://github.com/SBUnivers/SubReel.Launcher/releases/tag/v0.2.0" required className={input}/></label>
   <label className="flex items-center gap-2 text-sm text-zinc-300 md:col-span-2"><input type="checkbox" name="publish"/>Опубликовать сразу</label>
   <button className="w-fit rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold hover:bg-violet-400">Создать релиз</button>
  </form>
  <section className="space-y-3"><h2 className="text-xl font-semibold">Последние записи</h2>{!releases?.length&&<p className="text-sm text-zinc-500">Релизов пока нет.</p>}{releases?.map(r=><article key={r.id} className="rounded-2xl border border-white/10 p-4">
   <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-semibold">{r.title} <span className="text-sm text-zinc-400">· {r.version} · {r.channel}</span></p><p className="mt-1 text-sm text-zinc-500">{r.status==="published"?"Опубликован":"Черновик"} · {r.published_at?new Date(r.published_at).toLocaleString("ru-RU"):""}</p></div><form action={setReleaseStatus}><input type="hidden" name="id" value={r.id}/><input type="hidden" name="status" value={r.status==="published"?"draft":"published"}/><button className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10">{r.status==="published"?"Снять с публикации":"Опубликовать"}</button></form></div>
   <details className="mt-4"><summary className="cursor-pointer text-sm text-violet-300">Редактировать</summary><form action={updateRelease} className="mt-4 grid gap-4 md:grid-cols-2">
    <input type="hidden" name="id" value={r.id}/>
    <label><span className={label}>Версия</span><input name="version" required maxLength={64} defaultValue={r.version} className={input}/></label>
    <label><span className={label}>Канал</span><select name="channel" defaultValue={r.channel} className={input}><option value="stable">Стабильный</option><option value="beta">Бета</option></select></label>
    <label><span className={label}>Тип новости</span><select name="news_tag" defaultValue={r.news_tag??"launcher"} className={input}><option value="launcher">Лаунчер</option><option value="server">Сервер</option><option value="event">Событие</option></select></label>
    <label><span className={label}>HTTPS-ссылка на обложку (необязательно)</span><input name="cover_url" type="url" defaultValue={r.cover_url??""} className={input}/></label>
    <label className="md:col-span-2"><span className={label}>Заголовок</span><input name="title" required maxLength={160} defaultValue={r.title} className={input}/></label>
    <label className="md:col-span-2"><span className={label}>Описание</span><textarea name="summary" required maxLength={2000} rows={3} defaultValue={r.summary} className={input}/></label>
    <label className="md:col-span-2"><span className={label}>Список изменений</span><textarea name="change_notes" rows={4} defaultValue={(r.change_notes??[]).join("\n")} className={input}/></label>
    <label className="md:col-span-2"><span className={label}>GitHub Release URL</span><input name="github_release_url" type="url" required defaultValue={r.github_release_url} className={input}/></label>
    <button className="w-fit rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold hover:bg-violet-400">Сохранить</button>
   </form></details>
  </article>)}</section>
 </main>;
}
