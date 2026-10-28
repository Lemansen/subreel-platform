import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { createPublication, setPublicationStatus, updatePublication } from "./actions";

export const instant = false;
type Props = { searchParams: Promise<{ error?: string; success?: string }> };
const input = "w-full min-w-0 rounded-xl border border-white/10 bg-[#101018] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400";
const label = "mb-1.5 block text-sm text-zinc-300";
const kinds = [
  ["announcement","Объявление"],["devlog","Дневник разработки"],["feature","Новая функция"],
  ["maintenance","Технические работы"],["server_event","Событие сервера"],["tournament","Турнир"],
  ["community","Сообщество"],["recruitment","Набор участников / тестеров"],["roadmap","Дорожная карта"],
  ["incident","Инцидент / важное уведомление"],["guide","Инструкция"],["other","Другое"],
] as const;
const kindName = (kind: string) => kinds.find(([value]) => value === kind)?.[1] ?? kind;
function dateValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
}
function Fields({ item }: { item?: any }) {
  return <>
    <label><span className={label}>Тип публикации</span><select name="kind" defaultValue={item?.kind ?? "announcement"} className={input}>{kinds.map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label>
    <label><span className={label}>Короткий адрес (slug, необязательно)</span><input name="slug" defaultValue={item?.slug ?? ""} maxLength={180} placeholder="beta-test-launcher" className={input}/></label>
    <label className="sm:col-span-2"><span className={label}>Заголовок</span><input name="title" required maxLength={180} defaultValue={item?.title ?? ""} className={input}/></label>
    <label className="sm:col-span-2"><span className={label}>Краткое описание для карточек</span><textarea name="summary" required maxLength={2400} rows={3} defaultValue={item?.summary ?? ""} className={input}/></label>
    <label className="sm:col-span-2"><span className={label}>Полный текст (можно оставить пустым)</span><textarea name="body" maxLength={30000} rows={7} defaultValue={item?.body ?? ""} placeholder="Подробности, шаги, правила, список изменений…" className={input}/></label>
    <label className="sm:col-span-2"><span className={label}>Обложка — HTTPS-ссылка на изображение</span><input name="cover_image_url" type="url" defaultValue={item?.cover_image_url ?? ""} placeholder="https://…" className={input}/></label>
    <label className="sm:col-span-2"><span className={label}>Теги через запятую</span><input name="tags" defaultValue={(item?.tags ?? []).join(", ")} placeholder="лаунчер, beta, тестирование" className={input}/></label>
    <label><span className={label}>Текст кнопки (необязательно)</span><input name="cta_label" defaultValue={item?.cta_label ?? ""} maxLength={60} placeholder="Скачать лаунчер" className={input}/></label>
    <label><span className={label}>Ссылка кнопки (HTTPS)</span><input name="cta_url" type="url" defaultValue={item?.cta_url ?? ""} placeholder="https://…" className={input}/></label>
    <label><span className={label}>Начало события</span><input name="starts_at" type="datetime-local" defaultValue={dateValue(item?.starts_at)} className={input}/></label>
    <label><span className={label}>Окончание события</span><input name="ends_at" type="datetime-local" defaultValue={dateValue(item?.ends_at)} className={input}/></label>
    <label className="sm:col-span-2"><span className={label}>Запланировать публикацию (дата и время)</span><input name="scheduled_at" type="datetime-local" defaultValue={dateValue(item?.scheduled_at)} className={input}/><span className="mt-1 block text-xs text-zinc-500">Публичная лента не покажет публикацию раньше этого времени.</span></label>
    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" name="pinned" defaultChecked={item?.pinned ?? false}/>Закрепить в ленте</label>
  </>;
}
export default async function MinecraftEventsAdmin({ searchParams }: Props) {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect("/login?next=%2Fadmin%2Fminecraft%2Fevents");
  if (user.app_metadata?.role !== "catalog_admin") redirect("/");
  const query = await searchParams;
  const { data: items, error: listError } = await db.from("minecraft_publications")
    .select("id,slug,kind,title,summary,body,cover_image_url,tags,cta_label,cta_url,status,pinned,starts_at,ends_at,scheduled_at,published_at,created_at")
    .order("created_at", { ascending: false }).limit(100);
  return <><SiteHeader active="minecraft"/><main className="mx-auto max-w-6xl space-y-7 px-4 py-6 text-white sm:px-6 sm:py-10">
    <header className="rounded-3xl border border-sky-300/15 bg-[radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.16),transparent_55%),linear-gradient(135deg,rgba(30,27,75,0.4),rgba(17,17,25,0.95))] p-5 sm:p-8">
      <Link href="/admin/launcher-releases" className="text-sm text-sky-300 hover:text-sky-200">← Релизы лаунчера</Link>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-sky-300">SubReel · Minecraft</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Публикации и события</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">Единый редактор для новостей, дневников разработки, анонсов функций, техработ, событий сервера, турниров, набора тестеров, дорожной карты и важных уведомлений. Работает на мобильных экранах.</p>
      <div className="mt-5 flex flex-wrap gap-2"><Link href="/minecraft" className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5">Страница Minecraft</Link><Link href="/admin/launcher-releases" className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5">Релизы лаунчера</Link></div>
    </header>
    {(query.error || listError) && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm">{query.error ? "Не удалось сохранить публикацию. Проверь поля и применение SQL-файла 036." : "Не удалось загрузить записи. Возможно, SQL-файл 036 ещё не применён в Supabase."}</p>}
    {query.success && <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm">Изменения сохранены.</p>}
    <section className="grid gap-3 sm:grid-cols-3">{[{title:"Всего",value:items?.length ?? 0},{title:"Опубликовано",value:items?.filter(x=>x.status==="published").length ?? 0},{title:"Черновики / архив",value:items?.filter(x=>x.status!=="published").length ?? 0}].map(stat=><article key={stat.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-zinc-400">{stat.title}</p><p className="mt-2 text-2xl font-black tabular-nums">{stat.value}</p></article>)}</section>
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6"><h2 className="mb-4 text-xl font-bold">Новая публикация</h2><form action={createPublication} className="grid min-w-0 gap-4 sm:grid-cols-2"><Fields/><div className="flex flex-wrap items-center gap-4 sm:col-span-2"><label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" name="publish"/>Опубликовать сразу</label><button className="min-h-11 rounded-xl bg-sky-400 px-5 text-sm font-bold text-[#07101d] transition hover:bg-sky-300">Создать публикацию</button></div></form></section>
    <section className="space-y-3"><div><h2 className="text-xl font-bold">Последние публикации</h2><p className="mt-1 text-sm text-zinc-500">До 100 записей, включая черновики и архив.</p></div>
      {!items?.length && <p className="rounded-2xl border border-white/10 p-5 text-sm text-zinc-400">Записей пока нет.</p>}
      {items?.map(item=><article key={item.id} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-sky-300/20 bg-sky-300/[0.07] px-2.5 py-1 text-xs text-sky-200">{kindName(item.kind)}</span><span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-300">{item.status==="published"?"Опубликовано":item.status==="archived"?"Архив":"Черновик"}</span>{item.pinned&&<span className="text-xs text-amber-200">★ Закреплено</span>}</div><h3 className="mt-3 break-words text-lg font-bold">{item.title}</h3><p className="mt-1 break-words text-sm leading-6 text-zinc-400">{item.summary}</p><p className="mt-2 break-all text-xs text-zinc-500">/minecraft/events/{item.slug}</p></div>
          <form action={setPublicationStatus} className="flex shrink-0 flex-wrap gap-2"><input type="hidden" name="id" value={item.id}/>{item.status!=="published"?<button name="status" value="published" className="min-h-10 rounded-lg border border-sky-300/25 px-3 text-sm text-sky-200 hover:bg-sky-300/10">Опубликовать</button>:<button name="status" value="draft" className="min-h-10 rounded-lg border border-white/15 px-3 text-sm hover:bg-white/5">Снять</button>}{item.status!=="archived"&&<button name="status" value="archived" className="min-h-10 rounded-lg border border-white/15 px-3 text-sm text-zinc-400 hover:bg-white/5">В архив</button>}</form>
        </div>
        <details className="mt-4 border-t border-white/10 pt-4"><summary className="cursor-pointer text-sm font-semibold text-sky-300">Редактировать</summary><form action={updatePublication} className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2"><input type="hidden" name="id" value={item.id}/><Fields item={item}/><button className="min-h-11 w-fit rounded-xl bg-sky-400 px-5 text-sm font-bold text-[#07101d] hover:bg-sky-300 sm:col-span-2">Сохранить изменения</button></form></details>
      </article>)}
    </section>
  </main></>;
}
