import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { contentLabels } from "@/lib/catalog";
import { TitleStatusForm } from "./title-status-form";
import { addReadingSource, addVideoSource, createChapter, createEpisode, createSeason, createTitle } from "./actions";

type Props={searchParams:Promise<{success?:string;error?:string}>};
type Title={id:string;name:string;slug:string;content_type:string;status:string};
type Season={id:string;title_id:string;season_number:number;name:string|null};
type Episode={id:string;title_id:string;episode_number:number;name:string|null};
type Chapter={id:string;title_id:string;chapter_label:string;name:string|null};
type Source={id:string;title_id:string;source_url:string;rights_status:string;publication_status:string};
const field="w-full rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400";
const label="mb-1.5 block text-sm text-zinc-300";
const button="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold hover:bg-violet-400";

function TitleSelect({titles}:{titles:Title[]}){
 return <select className={field} name="title_id" required defaultValue=""><option value="" disabled>Выбери тайтл</option>{titles.map(t=><option key={t.id} value={t.id}>{t.name} · {t.status}</option>)}</select>;
}
function Sources({title,items}:{title:string;items:Source[]}){
 return <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><h2 className="text-lg font-bold">{title}</h2>{items.length===0?<p className="mt-3 text-sm text-zinc-500">Источников пока нет.</p>:<ul className="mt-3 space-y-2">{items.map(x=><li key={x.id} className="break-all rounded-xl bg-black/20 p-3 text-xs text-zinc-400"><p className="text-sm text-white">{x.rights_status} · {x.publication_status}</p>{x.source_url}</li>)}</ul>}</section>;
}

async function AdminContent({searchParams}:Props){
 await connection();
 const query=await searchParams;
 const db=await createClient();
 const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)redirect("/login?next=%2Fadmin");
 if(user.app_metadata?.role!=="catalog_admin")notFound();

 const [tRes,sRes,eRes,cRes,vRes,rRes]=await Promise.all([
  db.from("titles").select("id,name,slug,content_type,status").order("created_at",{ascending:false}).limit(200),
  db.from("title_seasons").select("id,title_id,season_number,name").order("season_number").limit(500),
  db.from("title_episodes").select("id,title_id,episode_number,name").order("sort_order").limit(1000),
  db.from("title_chapters").select("id,title_id,chapter_label,name").order("sort_order").limit(1000),
  db.from("video_sources").select("id,title_id,source_url,rights_status,publication_status").order("created_at",{ascending:false}).limit(100),
  db.from("reading_sources").select("id,title_id,source_url,rights_status,publication_status").order("created_at",{ascending:false}).limit(100),
 ]);
 const titles=(tRes.data??[]) as Title[], seasons=(sRes.data??[]) as Season[], episodes=(eRes.data??[]) as Episode[], chapters=(cRes.data??[]) as Chapter[];
 const video=(vRes.data??[]) as Source[], reading=(rRes.data??[]) as Source[];
 const titleName=new Map(titles.map(t=>[t.id,t.name]));
 const loadError=[tRes.error,sRes.error,eRes.error,cRes.error,vRes.error,rRes.error].some(Boolean);
 const notices:Record<string,string>={"title-created":"Черновик тайтла создан.","title-updated":"Статус и slug тайтла сохранены.","season-created":"Сезон добавлен.","episode-created":"Серия добавлена.","chapter-created":"Глава добавлена.","video-source-added":"Видеоисточник опубликован после подтверждения прав.","reading-source-added":"Источник чтения опубликован после подтверждения прав."};
 const errors:Record<string,string>={invalid:"Проверь поля и допустимые значения.",rights:"Для публикации подтверди право распространения источника.",save:"Не удалось сохранить данные. Проверь обязательные поля и связи.","slug-taken":"Этот slug уже занят другим тайтлом. Выбери другой."};

 return <main className="min-h-screen bg-background text-white"><SiteHeader active="catalog"/><div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
  <Link href="/catalog" className="text-sm text-violet-300 hover:text-violet-200">← В каталог</Link>
  <h1 className="mt-4 text-3xl font-black">Управление каталогом</h1>
  <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Новые тайтлы и структурные единицы создаются черновиками. Источник публикуется только после явного подтверждения права на распространение.</p>
  {query.success&&notices[query.success]&&<p role="status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notices[query.success]}</p>}
  {query.error&&<p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{errors[query.error]??"Операция не выполнена."}</p>}
  {loadError&&<p role="alert" className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">Не удалось загрузить часть каталога. Проверь миграции и права Supabase.</p>}

  <section className="mt-8 grid gap-5 lg:grid-cols-2">
   <form action={createTitle} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
    <h2 className="text-xl font-bold">Новый тайтл</h2>
    <label className={label}>Название<input className={field} name="name" required maxLength={160}/></label>
    <label className={label}>Slug<input className={field} name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={160} placeholder="my-title"/></label>
    <label className={label}>Тип<select className={field} name="content_type">{Object.entries(contentLabels).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
    <label className={label}>Год<input className={field} name="release_year" type="number" min={1800} max={2200}/></label>
    <label className={label}>Обложка (HTTPS)<input className={field} name="cover_url" type="url"/></label>
    <label className={label}>Описание<textarea className={field} name="description" rows={3} maxLength={5000}/></label>
    <button className={button}>Создать черновик</button>
   </form>

   <TitleStatusForm titles={titles}/>

   <form action={createSeason} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
    <h2 className="text-xl font-bold">Добавить сезон</h2><label className={label}>Тайтл<TitleSelect titles={titles}/></label>
    <label className={label}>Номер<input className={field} name="season_number" type="number" min={1} max={9999} required/></label>
    <label className={label}>Название (необязательно)<input className={field} name="name" maxLength={160}/></label>
    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" name="publish" value="yes"/>Опубликовать сразу</label><button className={button}>Добавить сезон</button>
   </form>

   <form action={createEpisode} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
    <h2 className="text-xl font-bold">Добавить серию</h2><label className={label}>Тайтл<TitleSelect titles={titles}/></label>
    <label className={label}>Сезон<select className={field} name="season_id"><option value="">Без сезона</option>{seasons.map(s=><option key={s.id} value={s.id}>{titleName.get(s.title_id)} · {s.name||`Сезон ${s.season_number}`}</option>)}</select></label>
    <label className={label}>Номер<input className={field} name="episode_number" type="number" min="0.01" step="0.01" required/></label>
    <label className={label}>Название (необязательно)<input className={field} name="name" maxLength={160}/></label>
    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" name="publish" value="yes"/>Опубликовать сразу</label><button className={button}>Добавить серию</button>
   </form>

   <form action={createChapter} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
    <h2 className="text-xl font-bold">Добавить главу к тайтлу</h2><label className={label}>Тайтл<TitleSelect titles={titles}/></label>
    <label className={label}>Метка<input className={field} name="chapter_label" required maxLength={80} placeholder="1, 1.5 или Special 1"/></label>
    <label className={label}>Порядок<input className={field} name="sort_order" type="number" min={1} defaultValue={1} required/></label>
    <label className={label}>Название (необязательно)<input className={field} name="name" maxLength={160}/></label>
    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" name="publish" value="yes"/>Опубликовать сразу</label><button className={button}>Добавить главу</button>
   </form>
  </section>

  <section className="mt-8 grid gap-5 lg:grid-cols-2">
   <form action={addVideoSource} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
    <h2 className="text-xl font-bold">Разрешённый видеоисточник</h2><label className={label}>Тайтл<TitleSelect titles={titles}/></label>
    <label className={label}>Серия (необязательно)<select className={field} name="episode_id"><option value="">На уровне тайтла</option>{episodes.map(e=><option key={e.id} value={e.id}>{titleName.get(e.title_id)} · серия {e.episode_number}{e.name?` · ${e.name}`:""}</option>)}</select></label>
    <label className={label}>Ссылка HTTPS<input className={field} name="source_url" type="url" required/></label>
    <label className={label}>Формат<select className={field} name="source_format">{["hls","dash","mp4","embed"].map(x=><option key={x}>{x}</option>)}</select></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className={label}>Провайдер<input className={field} name="provider_name" maxLength={120}/></label><label className={label}>Язык<input className={field} name="language_code" maxLength={35} placeholder="ru"/></label></div>
    <label className={label}>Качество<input className={field} name="quality_label" maxLength={80} placeholder="1080p"/></label>
    <label className="flex items-start gap-2 text-sm leading-5 text-zinc-300"><input className="mt-1" type="checkbox" name="rights_confirmed" value="yes" required/>Подтверждаю право SubReel публиковать ссылку и связанное медиа.</label>
    <button className={button}>Добавить и опубликовать</button>
   </form>

   <form action={addReadingSource} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
    <h2 className="text-xl font-bold">Разрешённый источник чтения</h2><label className={label}>Тайтл<TitleSelect titles={titles}/></label>
    <label className={label}>Глава (необязательно)<select className={field} name="chapter_id"><option value="">На уровне тайтла</option>{chapters.map(c=><option key={c.id} value={c.id}>{titleName.get(c.title_id)} · глава {c.chapter_label}{c.name?` · ${c.name}`:""}</option>)}</select></label>
    <label className={label}>Ссылка HTTPS<input className={field} name="source_url" type="url" required/></label>
    <label className={label}>Формат<select className={field} name="source_format">{["image_pages","pdf","epub","html","plain_text"].map(x=><option key={x}>{x}</option>)}</select></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className={label}>Провайдер<input className={field} name="provider_name" maxLength={120}/></label><label className={label}>Язык<input className={field} name="language_code" maxLength={35} placeholder="ru"/></label></div>
    <label className="flex items-start gap-2 text-sm leading-5 text-zinc-300"><input className="mt-1" type="checkbox" name="rights_confirmed" value="yes" required/>Подтверждаю право SubReel публиковать ссылку и связанный материал.</label>
    <button className={button}>Добавить и опубликовать</button>
   </form>
  </section>

  <section className="mt-10"><h2 className="text-2xl font-bold">Текущие тайтлы</h2>{titles.length===0?<p className="mt-3 text-sm text-zinc-400">Каталог пока пуст.</p>:<ul className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10">{titles.map(t=><li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{t.name}</p><p className="mt-1 text-xs text-zinc-500">{t.slug} · {contentLabels[t.content_type]||t.content_type} · {t.status}</p></div><Link href={`/title/${t.slug}`} className="text-sm text-violet-300">Открыть</Link></li>)}</ul>}</section>
  <section className="mt-8 grid gap-5 lg:grid-cols-2"><Sources title="Видеоисточники" items={video}/><Sources title="Источники чтения" items={reading}/></section>
 </div></main>;
}


export default function AdminPage({searchParams}:Props){
 return <Suspense fallback={<main className="min-h-screen bg-background p-8 text-white"><p>Загружаем управление каталогом…</p></main>}>
  <AdminContent searchParams={searchParams}/>
 </Suspense>;
}
