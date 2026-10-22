import Link from "next/link";
import {Suspense} from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { contentLabels } from "@/lib/catalog";
import { TitleRowActions } from "./title-row-actions";

type Params = Promise<{q?:string;type?:string;status?:string;changed?:string;page?:string}>;
const pageSize=25;
function changedAfter(days:number){return new Date(Date.now()-days*86400000).toISOString();}
async function TitlesContent({searchParams}:{searchParams:Params}) {
  await connection();
  const query=await searchParams, db=await createClient();
  const {data:{user},error}=await db.auth.getUser();
  if(error||!user) redirect("/login?next=%2Fadmin%2Ftitles");
  if(user.app_metadata?.role!=="catalog_admin") notFound();
  const q=(query.q??"").trim().slice(0,160), type=query.type??"", status=query.status??"", changed=query.changed??"";
  const page=Math.max(1,Number.parseInt(query.page??"1",10)||1);
  let request=db.from("titles").select("id,name,slug,content_type,status,cover_url,updated_at,created_at",{count:"exact"});
  if(q){const safe=q.replace(/[^\p{L}\p{N}_ -]/gu," ").replace(/\s+/g," ").trim();const clauses=safe?[`name.ilike.%${safe}%`,`slug.ilike.%${safe}%`]:[];if(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(q))clauses.push(`id.eq.${q}`);if(clauses.length)request=request.or(clauses.join(","));else request=request.eq("id","00000000-0000-0000-0000-000000000000");}
  if(type)request=request.eq("content_type",type);
  if(["draft","published","archived"].includes(status))request=request.eq("status",status);
  const windows:Record<string,number>={day:1,week:7,month:30,older:30};
  if(windows[changed]){const since=changedAfter(windows[changed]);request=changed==="older"?request.lt("updated_at",since):request.gte("updated_at",since);}
  const {data:titles,error:loadError,count}=await request.order("updated_at",{ascending:false}).range((page-1)*pageSize,page*pageSize-1);
  const rows=titles??[], ids=rows.map(t=>t.id);
  const [seasons,episodes,volumes,chapters,audit]=ids.length?await Promise.all([
    db.from("title_seasons").select("title_id").in("title_id",ids).limit(10000), db.from("title_episodes").select("title_id").in("title_id",ids).limit(10000),
    db.from("title_volumes").select("title_id").in("title_id",ids).limit(10000), db.from("title_chapters").select("title_id").in("title_id",ids).limit(10000),
    db.from("catalog_audit_log").select("title_id,actor_id,created_at").in("title_id",ids).order("created_at",{ascending:false}).limit(1000),
  ]):[{data:[]},{data:[]},{data:[]},{data:[]},{data:[]}];
  const auditRows=audit.data??[], actorIds=[...new Set(auditRows.map(x=>x.actor_id).filter(Boolean))];
  const {data:profiles}=actorIds.length?await db.from("profiles").select("id,username,display_name").in("id",actorIds):{data:[]};
  const profileMap=new Map((profiles??[]).map(p=>[p.id,p.display_name||p.username||p.id.slice(0,8)]));
  const tally=(items:{title_id:string}[]|null|undefined,id:string)=>items?.filter(x=>x.title_id===id).length??0;
  const totalPages=Math.max(1,Math.ceil((count??0)/pageSize));
  function href(nextPage:number){const p=new URLSearchParams();if(q)p.set("q",q);if(type)p.set("type",type);if(status)p.set("status",status);if(changed)p.set("changed",changed);p.set("page",String(nextPage));return `/admin/titles?${p.toString()}`;}
  return <main className="min-h-screen bg-background text-white"><SiteHeader active="catalog"/><div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
    <Link href="/admin" className="text-sm text-violet-300">← Админ-панель</Link><div className="mt-5 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black">Редактор тайтлов</h1><p className="mt-2 text-sm text-zinc-400">Поиск, публикация и редактирование записей каталога.</p></div><Link href="/admin/titles/new" className="rounded-xl bg-violet-500 px-4 py-3 text-sm font-bold hover:bg-violet-400">+ Создать тайтл</Link></div>
    <form className="mt-7 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-5" action="/admin/titles"><input name="q" defaultValue={q} placeholder="Название, slug или ID" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm md:col-span-2"/><select name="type" defaultValue={type} className="rounded-xl border border-white/10 bg-[#111119] px-3 py-2 text-sm"><option value="">Все типы</option>{Object.entries(contentLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><select name="status" defaultValue={status} className="rounded-xl border border-white/10 bg-[#111119] px-3 py-2 text-sm"><option value="">Все статусы</option><option value="draft">Черновик</option><option value="published">Опубликован</option><option value="archived">Архив</option></select><select name="changed" defaultValue={changed} className="rounded-xl border border-white/10 bg-[#111119] px-3 py-2 text-sm"><option value="">Любая дата изменения</option><option value="day">За 24 часа</option><option value="week">За 7 дней</option><option value="month">За 30 дней</option><option value="older">Старше 30 дней</option></select><button className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold md:col-span-5 md:justify-self-end">Найти</button></form>
    {loadError?<p role="alert" className="mt-6 rounded-xl bg-red-500/10 p-4 text-red-200">Не удалось загрузить тайтлы. Проверь соединение и права Supabase.</p>:<><p className="mt-5 text-sm text-zinc-400">Найдено: {count??0}. Страница {Math.min(page,totalPages)} из {totalPages}.</p><div className="mt-3 overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-white/[0.04] text-xs text-zinc-400"><tr>{["Тайтл","Тип","Статус","Структура","Изменён","Автор","Действия"].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody className="divide-y divide-white/10">{rows.map(t=>{const last=auditRows.find(a=>a.title_id===t.id);return <tr key={t.id} className="align-top"><td className="px-4 py-4"><div className="flex items-center gap-3">{t.cover_url?<img src={t.cover_url} alt="" className="h-16 w-11 rounded object-cover"/>:<div className="h-16 w-11 rounded bg-white/5"/>}<div><Link className="font-semibold hover:text-violet-300" href={`/admin/titles/${t.id}/edit`}>{t.name}</Link><p className="mt-1 text-xs text-zinc-500">{t.slug} · {t.id.slice(0,8)}</p></div></div></td><td className="px-4 py-4">{contentLabels[t.content_type]??t.content_type}</td><td className="px-4 py-4">{t.status==="published"?"Опубликован":t.status==="archived"?"Архив":"Черновик"}</td><td className="px-4 py-4 text-xs text-zinc-300">{["manga","manhwa","manhua","light_novel","web_novel","book"].includes(t.content_type)?`${tally(volumes.data,t.id)} томов · ${tally(chapters.data,t.id)} глав`:`${tally(seasons.data,t.id)} сезонов · ${tally(episodes.data,t.id)} серий`}</td><td className="px-4 py-4 text-xs text-zinc-400">{new Date(last?.created_at??t.updated_at).toLocaleString("ru-RU")}</td><td className="px-4 py-4 text-xs text-zinc-400">{last?.actor_id?profileMap.get(last.actor_id)??last.actor_id.slice(0,8):"—"}</td><td className="px-4 py-4"><TitleRowActions id={t.id} slug={t.slug} name={t.name} status={t.status}/></td></tr>;})}</tbody></table>{!rows.length&&<p className="p-8 text-center text-sm text-zinc-500">Тайтлы не найдены.</p>}</div><nav className="mt-5 flex justify-between"><Link aria-disabled={page<=1} className={`rounded-lg border border-white/10 px-4 py-2 text-sm ${page<=1?"pointer-events-none opacity-40":""}`} href={href(Math.max(1,page-1))}>← Назад</Link><Link aria-disabled={page>=totalPages} className={`rounded-lg border border-white/10 px-4 py-2 text-sm ${page>=totalPages?"pointer-events-none opacity-40":""}`} href={href(Math.min(totalPages,page+1))}>Дальше →</Link></nav></>}</div></main>;
}
export default function TitlesPage({searchParams}:{searchParams:Params}) {return <Suspense fallback={<main className="min-h-screen bg-background p-8 text-white">Загружаем редактор тайтлов…</main>}><TitlesContent searchParams={searchParams}/></Suspense>;}
