import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
const labels: Record<string,string> = {
 announcement:"Объявление",devlog:"Дневник разработки",feature:"Обновление",maintenance:"Технические работы",
 server_event:"Событие сервера",tournament:"Турнир",community:"Сообщество",recruitment:"Набор тестеров",
 roadmap:"Дорожная карта",incident:"Важное уведомление",guide:"Инструкция",other:"Другое",
};
export async function generateMetadata({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params; const db=await createClient();
 const {data}=await db.from("minecraft_publications").select("title,summary").eq("slug",slug).eq("status","published").maybeSingle();
 return {title:data? `${data.title} — SubReel Minecraft`:"Новость Minecraft — SubReel",description:data?.summary};
}
export default async function MinecraftEventDetail({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params; const db=await createClient();
 const {data:item}=await db.from("minecraft_publications").select("slug,kind,title,summary,body,cover_image_url,tags,cta_label,cta_url,starts_at,ends_at,published_at")
  .eq("slug",slug).eq("status","published").or("scheduled_at.is.null,scheduled_at.lte."+new Date().toISOString()).maybeSingle();
 if(!item) notFound();
 return <><SiteHeader active="minecraft"/><main className="mx-auto min-h-screen max-w-4xl px-4 py-8 text-white sm:px-6 sm:py-12">
  <Link href="/minecraft/events" className="text-sm text-sky-300 hover:text-sky-200">← Все новости и события</Link>
  <article className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">
   {item.cover_image_url&&<img src={item.cover_image_url} alt="" className="max-h-[28rem] w-full object-cover"/>}
   <div className="p-5 sm:p-9"><span className="rounded-full border border-sky-300/20 bg-sky-300/[0.07] px-3 py-1.5 text-xs text-sky-200">{labels[item.kind]??item.kind}</span>
    <h1 className="mt-5 break-words text-3xl font-black tracking-tight sm:text-4xl">{item.title}</h1>
    <p className="mt-4 text-base leading-7 text-zinc-300">{item.summary}</p>
    <p className="mt-4 text-xs text-zinc-500">{item.published_at?new Date(item.published_at).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"}):""}</p>
    {item.starts_at&&<div className="mt-5 rounded-xl border border-sky-300/15 bg-sky-300/[0.05] p-4 text-sm text-sky-100">Начало события: {new Date(item.starts_at).toLocaleString("ru-RU")}{item.ends_at? ` · Окончание: ${new Date(item.ends_at).toLocaleString("ru-RU")}`:""}</div>}
    {item.tags?.length>0&&<div className="mt-5 flex flex-wrap gap-2">{item.tags.map((tag:string)=><span key={tag} className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-zinc-300">#{tag}</span>)}</div>}
    {item.body&&<div className="mt-8 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-200">{item.body}</div>}
    {item.cta_label&&item.cta_url&&<a href={item.cta_url} target="_blank" rel="noreferrer" className="mt-8 inline-flex min-h-11 items-center rounded-xl bg-sky-400 px-5 font-bold text-[#07101d] transition hover:bg-sky-300">{item.cta_label} ↗</a>}
   </div>
  </article>
 </main></>;
}
