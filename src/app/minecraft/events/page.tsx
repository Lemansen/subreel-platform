import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
const labels: Record<string,string> = {
 announcement:"Объявление",devlog:"Дневник разработки",feature:"Обновление",maintenance:"Технические работы",
 server_event:"Событие сервера",tournament:"Турнир",community:"Сообщество",recruitment:"Набор тестеров",
 roadmap:"Дорожная карта",incident:"Важное уведомление",guide:"Инструкция",other:"Другое",
};
export const metadata = { title: "Новости и события Minecraft — SubReel", description: "Новости, обновления, события сервера и дневники разработки SubReel Minecraft." };
export default async function MinecraftEventsPage() {
 const db = await createClient();
 const { data } = await db.from("minecraft_publications")
   .select("id,slug,kind,title,summary,cover_image_url,tags,pinned,starts_at,published_at")
   .eq("status","published").or("scheduled_at.is.null,scheduled_at.lte." + new Date().toISOString())
   .order("pinned",{ascending:false}).order("published_at",{ascending:false}).limit(60);
 return <><SiteHeader active="minecraft"/><main className="mx-auto min-h-screen max-w-6xl px-4 py-8 text-white sm:px-6 sm:py-12">
  <Link href="/minecraft" className="text-sm text-sky-300 hover:text-sky-200">← Minecraft</Link>
  <header className="mt-5 rounded-3xl border border-sky-300/15 bg-[radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.16),transparent_55%),linear-gradient(135deg,rgba(30,27,75,0.4),rgba(17,17,25,0.95))] p-6 sm:p-10">
   <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">SubReel · Новости</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">Новости и события</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">Обновления лаунчера, дневники разработки, события Minecraft, технические работы и новости сообщества — в одном месте.</p>
  </header>
  {!data?.length ? <div className="mt-6 rounded-2xl border border-white/10 p-6 text-sm text-zinc-400">Публикации скоро появятся.</div> : <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.map(item=><Link key={item.id} href={`/minecraft/events/${item.slug}`} className="group min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:-translate-y-0.5 hover:border-sky-300/30 hover:bg-white/[0.05]">
   {item.cover_image_url ? <div className="aspect-[16/9] overflow-hidden bg-white/5"><img src={item.cover_image_url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"/></div> : <div className="flex aspect-[16/9] items-end bg-gradient-to-br from-sky-950 via-[#17152a] to-[#09090d] p-4"><span className="text-xs font-bold uppercase tracking-[0.2em] text-sky-200">SubReel Minecraft</span></div>}
   <div className="p-5"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-sky-300/20 px-2.5 py-1 text-xs text-sky-200">{labels[item.kind] ?? item.kind}</span>{item.pinned&&<span className="text-xs text-amber-200">★ Закреплено</span>}</div><h2 className="mt-3 text-lg font-bold leading-snug group-hover:text-sky-200">{item.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-400">{item.summary}</p><p className="mt-4 text-xs text-zinc-500">{item.published_at ? new Date(item.published_at).toLocaleDateString("ru-RU") : ""}</p></div>
  </Link>)}</section>}
 </main></>;
}
