import { redirect } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { createRelease, setReleaseStatus, updateRelease } from "./actions";

// The admin page reads the signed-in user's session and database data per request.
export const instant = false;

type Props={searchParams:Promise<{error?:string;success?:string}>};
const input="w-full rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400";
const label="mb-1.5 block text-sm text-zinc-300";
export default async function LauncherReleasesPage({searchParams}:Props){
 const db=await createClient(); const {data:{user},error}=await db.auth.getUser();
 if(error||!user)redirect("/login?next=%2Fadmin%2Flauncher-releases");
 if(user.app_metadata?.role!=="catalog_admin")redirect("/");
 const query=await searchParams;
 const {data:releases}=await db.from("launcher_releases").select("id,version,channel,title,summary,change_notes,status,github_release_url,published_at,created_at").order("created_at",{ascending:false}).limit(100);
 return <><SiteHeader/><main className="mx-auto max-w-6xl space-y-8 px-4 py-6 text-white sm:px-6 sm:py-10">
  <div className="overflow-hidden rounded-3xl border border-violet-400/20 bg-[radial-gradient(ellipse_at_top_right,rgba(124,58,237,0.2),transparent_55%),linear-gradient(135deg,rgba(30,27,75,0.4),rgba(17,17,25,0.9))] p-5 sm:p-8"><Link href="/admin" className="text-sm text-violet-300 hover:text-violet-200">← Админ-панель</Link><div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">SubReel · Minecraft</p><h1 className="mt-2 text-3xl font-black tracking-tight">Релизы лаунчера</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">Управляй новостями обновлений, каналами stable и beta. Опубликованные записи становятся доступны клиентам и на сайте.</p></div><span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-zinc-300">Последние 100 записей</span></div><div className="mt-5 flex flex-wrap gap-2"><Link href="/admin/titles" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5">Каталог</Link><Link href="/admin?tab=users" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5">Пользователи</Link><Link href="/admin?tab=audit" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5">Журнал действий</Link></div></div><section className="grid gap-3 sm:grid-cols-3" aria-label="Сводка релизов">{[{label:"Всего в выборке",value:releases?.length??0,detail:"Последние записи"},{label:"Опубликовано",value:releases?.filter((release)=>release.status==="published").length??0,detail:"Доступны клиентам"},{label:"Черновики",value:releases?.filter((release)=>release.status!=="published").length??0,detail:"Не видны пользователям"}].map((item)=><article key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-zinc-400">{item.label}</p><p className="mt-2 text-2xl font-black tabular-nums">{item.value}</p><p className="mt-1 text-xs text-zinc-500">{item.detail}</p></article>)}</section>
  {query.error&&<p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm">Не удалось сохранить запись ({query.error}). Проверь поля и применение миграции.</p>}
  {query.success&&<p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm">Изменения сохранены.</p>}
  <form action={createRelease} className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:grid-cols-2">
   <label><span className={label}>Версия (например 0.2.0)</span><input name="version" required maxLength={64} className={input}/></label>
   <label><span className={label}>Канал</span><select name="channel" className={input}><option value="stable">Стабильный</option><option value="beta">Бета</option></select></label>
   <label className="md:col-span-2"><span className={label}>Заголовок новости</span><input name="title" required maxLength={160} className={input}/></label>
   <label className="md:col-span-2"><span className={label}>Описание обновления</span><textarea name="summary" required maxLength={2000} rows={3} className={input}/></label>
   <label className="md:col-span-2"><span className={label}>Список изменений (каждый пункт с новой строки)</span><textarea name="change_notes" rows={5} className={input}/></label>
   <label className="md:col-span-2"><span className={label}>Ссылка на тег GitHub Release</span><input name="github_release_url" type="url" placeholder="https://github.com/owner/repo/releases/tag/v0.2.0" required className={input}/></label>
   <label className="flex items-center gap-2 text-sm text-zinc-300 md:col-span-2"><input type="checkbox" name="publish"/>Опубликовать сразу</label>
   <button className="w-fit rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold hover:bg-violet-400">Создать релиз</button>
  </form>
  <section className="space-y-3"><h2 className="text-xl font-semibold">Последние записи</h2>{!releases?.length&&<p className="text-sm text-zinc-500">Релизов пока нет.</p>}{releases?.map(r=><article key={r.id} className="rounded-2xl border border-white/10 p-4">
   <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-semibold">{r.title} <span className="text-sm text-zinc-400">· {r.version} · {r.channel}</span></p><p className="mt-1 text-sm text-zinc-500">{r.status==="published"?"Опубликован":"Черновик"} · {r.published_at?new Date(r.published_at).toLocaleString("ru-RU"):""}</p></div><form action={setReleaseStatus}><input type="hidden" name="id" value={r.id}/><input type="hidden" name="status" value={r.status==="published"?"draft":"published"}/><button className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10">{r.status==="published"?"Снять с публикации":"Опубликовать"}</button></form></div>
   <details className="mt-4"><summary className="cursor-pointer text-sm text-violet-300">Редактировать</summary><form action={updateRelease} className="mt-4 grid gap-4 md:grid-cols-2">
    <input type="hidden" name="id" value={r.id}/>
    <label><span className={label}>Версия</span><input name="version" required maxLength={64} defaultValue={r.version} className={input}/></label>
    <label><span className={label}>Канал</span><select name="channel" defaultValue={r.channel} className={input}><option value="stable">Стабильный</option><option value="beta">Бета</option></select></label>
    <label className="md:col-span-2"><span className={label}>Заголовок</span><input name="title" required maxLength={160} defaultValue={r.title} className={input}/></label>
    <label className="md:col-span-2"><span className={label}>Описание</span><textarea name="summary" required maxLength={2000} rows={3} defaultValue={r.summary} className={input}/></label>
    <label className="md:col-span-2"><span className={label}>Список изменений</span><textarea name="change_notes" rows={4} defaultValue={(r.change_notes??[]).join("\n")} className={input}/></label>
    <label className="md:col-span-2"><span className={label}>GitHub Release URL</span><input name="github_release_url" type="url" required defaultValue={r.github_release_url} className={input}/></label>
    <button className="w-fit rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold hover:bg-violet-400">Сохранить</button>
   </form></details>
  </article>)}</section>
 </main></>;
}
