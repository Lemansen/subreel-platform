import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { FranchiseStatusForm } from "./franchise-status-form";
import { StructureEditor } from "./structure-editor";
import { UnitsEditor } from "./units-editor";
import { ProfileModerationForm } from "./profile-moderation-form";
import { UserRoleForm } from "./user-role-form";
import { RelationshipManager } from "./relationship-manager";
import { GenreManager } from "./genre-manager";
import { SourceManager } from "./source-manager";
import { listAuthUsers } from "@/lib/supabase/admin-users";
import { addGenreToTitle, addReadingSource, addVideoSource, createChapter, createEdition, createEpisode, createFranchise, createGenre, createSeason, createTitleRelationship, createVolume, removeGenreFromTitle } from "./actions";

type Props={searchParams:Promise<{success?:string;error?:string;tab?:string}>};
type Title={id:string;name:string;original_name:string|null;slug:string;content_type:string;status:string;release_year:number|null;franchise_id:string|null;description:string|null;cover_url:string|null;banner_url:string|null};
type Franchise={id:string;name:string;slug:string;status:string;description:string|null;cover_url:string|null};
type Genre={id:string;name:string;slug:string};
type Season={id:string;title_id:string;season_number:number;name:string|null;description:string|null;status:string};
type Episode={id:string;title_id:string;season_id:string|null;episode_number:number;sort_order:number;name:string|null;description:string|null;duration_seconds:number|null;release_date:string|null;status:string};
type Chapter={id:string;title_id:string;chapter_label:string;chapter_number:number|null;sort_order:number;name:string|null;description:string|null;release_date:string|null;status:string};
type Edition={id:string;title_id:string;edition_kind:string;edition_number:number;name:string;language_code:string|null;description:string|null;status:string};
type Volume={id:string;title_id:string;edition_id:string|null;volume_number:number;name:string|null;description:string|null;status:string};
type TitleGenre={title_id:string;genre_id:string};
type TitleRelationship={id:string;source_title_id:string;target_title_id:string;relationship_type:string};
type Source={id:string;title_id:string;source_url:string;source_format:string;provider_name:string|null;language_code:string|null;quality_label?:string|null;rights_status:string;availability_status:string;publication_status:string};
type AuditEntry={id:string;actor_id:string|null;entity_table:string;action:string;entity_id:string;title_id:string|null;before_data:Record<string,unknown>|null;after_data:Record<string,unknown>|null;created_at:string};
type RoleAuditEntry={id:string;actor_id:string;target_email:string|null;previous_role:string|null;next_role:string|null;outcome:string;failure_message:string|null;created_at:string;completed_at:string|null};
type ModerationProfile={id:string;username:string|null;display_name:string|null;bio:string|null;is_public:boolean;is_suspended:boolean;suspension_reason:string|null;moderated_at:string|null};
const field="w-full rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400";
const label="mb-1.5 block text-sm text-zinc-300";
const button="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold hover:bg-violet-400";

function TitleSelect({titles}:{titles:Title[]}){
 return <select className={field} name="title_id" required defaultValue=""><option value="" disabled>Выбери тайтл</option>{titles.map(t=><option key={t.id} value={t.id}>{t.name} · {t.status}</option>)}</select>;
}
async function AdminContent({searchParams}:Props){
 await connection();
 const query=await searchParams;
 const db=await createClient();
 const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)redirect("/login?next=%2Fadmin");
 if(user.app_metadata?.role!=="catalog_admin")notFound();

 const authUsersResult=await listAuthUsers();
 const authUsers=authUsersResult.users?.map((authUser)=>({id:authUser.id,email:authUser.email??null,createdAt:authUser.created_at,role:typeof authUser.app_metadata.role==="string"?authUser.app_metadata.role:null}))??null;

 const [tRes,fRes,gRes,tgRes,sRes,eRes,edRes,volRes,cRes,vRes,rRes,aRes,pRes,roleAuditRes,relRes]=await Promise.all([
  db.from("titles").select("id,name,original_name,slug,content_type,status,release_year,franchise_id,description,cover_url,banner_url").order("created_at",{ascending:false}).limit(200),
  db.from("franchises").select("id,name,slug,status,description,cover_url").order("created_at",{ascending:false}).limit(200),
  db.from("genres").select("id,name,slug").order("name").limit(500),
  db.from("title_genres").select("title_id,genre_id").limit(2000),
  db.from("title_seasons").select("id,title_id,season_number,name,description,status").order("season_number").limit(500),
  db.from("title_episodes").select("id,title_id,season_id,episode_number,sort_order,name,description,duration_seconds,release_date,status").order("sort_order").limit(1000),
  db.from("title_editions").select("id,title_id,edition_kind,edition_number,name,language_code,description,status").order("edition_number").limit(500),
  db.from("title_volumes").select("id,title_id,edition_id,volume_number,name,description,status").order("volume_number").limit(1000),
  db.from("title_chapters").select("id,title_id,chapter_label,chapter_number,sort_order,name,description,release_date,status").order("sort_order").limit(1000),
  db.from("video_sources").select("id,title_id,source_url,source_format,provider_name,language_code,quality_label,rights_status,availability_status,publication_status").order("created_at",{ascending:false}).limit(100),
  db.from("reading_sources").select("id,title_id,source_url,source_format,provider_name,language_code,rights_status,availability_status,publication_status").order("created_at",{ascending:false}).limit(100),
  db.from("catalog_audit_log").select("id,actor_id,entity_table,action,entity_id,title_id,before_data,after_data,created_at").order("created_at",{ascending:false}).limit(100),
  db.from("profiles").select("id,username,display_name,bio,is_public,is_suspended,suspension_reason,moderated_at").order("updated_at",{ascending:false}).limit(200),
  db.from("admin_role_audit_log").select("id,actor_id,target_email,previous_role,next_role,outcome,failure_message,created_at,completed_at").order("created_at",{ascending:false}).limit(100),
  db.from("title_relationships").select("id,source_title_id,target_title_id,relationship_type").order("created_at",{ascending:false}).limit(500),
 ]);
 const titles=(tRes.data??[]) as Title[], franchises=(fRes.data??[]) as Franchise[], genres=(gRes.data??[]) as Genre[], titleGenres=(tgRes.data??[]) as TitleGenre[], seasons=(sRes.data??[]) as Season[], episodes=(eRes.data??[]) as Episode[], editions=(edRes.data??[]) as Edition[], volumes=(volRes.data??[]) as Volume[], chapters=(cRes.data??[]) as Chapter[];
 const video=(vRes.data??[]) as Source[], reading=(rRes.data??[]) as Source[];
 const auditEntries=(aRes.data??[]) as AuditEntry[];
 const moderationProfiles=(pRes.data??[]) as ModerationProfile[];
 const roleAuditEntries=(roleAuditRes.data??[]) as RoleAuditEntry[];
 const relationships=(relRes.data??[]) as TitleRelationship[];
 const titleName=new Map(titles.map(t=>[t.id,t.name]));
 const videoTitles=titles.filter(t=>["anime","movie","series","drama","cartoon"].includes(t.content_type));
 const readingTitles=titles.filter(t=>["manga","manhwa","manhua","light_novel","web_novel","book"].includes(t.content_type));
 const loadError=[tRes.error,fRes.error,gRes.error,tgRes.error,sRes.error,eRes.error,edRes.error,volRes.error,cRes.error,vRes.error,rRes.error,aRes.error,pRes.error,relRes.error].some(Boolean);
 const notices:Record<string,string>={"title-created":"Черновик тайтла создан.","title-updated":"Метаданные, статус и slug тайтла сохранены.","franchise-created":"Черновик франшизы создан.","franchise-updated":"Статус и slug франшизы сохранены.","genre-created":"Жанр создан.","genre-assigned":"Жанр привязан к тайтлу.","genre-removed":"Жанр отвязан от тайтла.","relationship-created":"Связь между тайтлами добавлена.","season-created":"Сезон добавлен.","season-updated":"Сезон обновлён.","episode-created":"Серия добавлена.","episode-updated":"Серия обновлена.","chapter-created":"Глава добавлена.","chapter-updated":"Глава обновлена.","edition-created":"Издание добавлено.","edition-updated":"Издание обновлено.","volume-created":"Том добавлен.","volume-updated":"Том обновлён.","profile-suspended":"Публичность профиля ограничена. Профиль скрыт; владелец не сможет включить публичность до снятия ограничения.","profile-restored":"Ограничение снято. Профиль остаётся приватным до повторного согласия владельца.","video-source-added":"Видеоисточник опубликован после подтверждения прав.","reading-source-added":"Источник чтения опубликован после подтверждения прав.","video-source-updated":"Видеоисточник обновлён.","reading-source-updated":"Источник чтения обновлён.","video-source-deleted":"Видеоисточник удалён.","reading-source-deleted":"Источник чтения удалён.","role-granted":"Пользователю назначена роль администратора каталога.","role-revoked":"Роль администратора снята.","role-updated-audit-warning":"Роль обновлена, но итог журнала не сохранился — проверь подключение к Supabase."};
 const errors:Record<string,string>={invalid:"Проверь поля и допустимые значения.","unsupported-embed":"Для embed используй URL встроенного плеера RuTube, YouTube NoCookie или Vimeo.","episode-not-published":"Сначала опубликуй сезон и серию или добавь источник на уровне всего тайтла.",rights:"Для публикации подтверди право распространения источника.",save:"Не удалось сохранить данные. Проверь обязательные поля и связи.","slug-taken":"Этот slug уже занят другим тайтлом. Выбери другой.","franchise-slug-taken":"Этот slug уже занят другой франшизой. Выбери другой.","genre-duplicate":"Жанр с таким названием или slug уже существует.","genre-invalid":"Выбери существующий тайтл и жанр.","genre-already-assigned":"Этот жанр уже привязан к выбранному тайтлу.","season-invalid":"Проверь сезон и допустимые значения.","season-duplicate":"У этого тайтла уже есть сезон с таким номером.","episode-invalid":"Проверь серию и допустимые значения.","episode-duplicate":"В этом тайтле или сезоне уже есть серия с таким номером.","chapter-invalid":"Проверь главу и допустимые значения.","chapter-duplicate":"В этой части тайтла уже занята такая позиция главы.","edition-invalid":"Проверь тайтл, тип, номер и название издания.","edition-duplicate":"Издание с таким типом и номером у тайтла уже существует.","volume-invalid":"Проверь тайтл, издание и номер тома.","volume-duplicate":"Том с таким номером для выбранного тайтла/издания уже существует.","profile-moderation-invalid":"Укажи профиль и причину ограничения.","profile-moderation-failed":"Не удалось выполнить модерацию. Проверь, применена ли миграция 017.","relationship-invalid":"Выбери два разных существующих тайтла и допустимый тип связи.","relationship-duplicate":"Такая связь между этими тайтлами уже существует.","role-invalid":"Некорректный пользователь или роль.","role-admin-key-missing":"Добавь SUPABASE_SERVICE_ROLE_KEY в серверные переменные окружения.","role-user-limit":"Список пользователей превышает защитный лимит. Изменения роли отключены.","role-users-load-failed":"Не удалось загрузить пользователей из Supabase.","role-user-not-found":"Пользователь не найден.","role-last-admin":"Нельзя снять роль у последнего администратора.","role-audit-unavailable":"Не удалось начать запись в журнал. Роль не изменена; проверь миграцию 018.","role-update-failed":"Supabase не смог обновить роль. Подробности записаны в серверный журнал."};

 return <main className="min-h-screen bg-background text-white"><SiteHeader active="catalog"/><div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
  <Link href="/catalog" className="text-sm text-violet-300 hover:text-violet-200">← В каталог</Link>
  <h1 className="mt-4 text-3xl font-black">Управление каталогом</h1>
  <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Новые тайтлы и структурные единицы создаются черновиками. Источник публикуется только после явного подтверждения права на распространение.</p>
  {query.success&&(notices[query.success]??(query.success.startsWith("relationship-")?"Связь сохранена.":query.success==="franchise-deleted"?"Франшиза удалена.":query.success.startsWith("genre-")?"Жанр сохранён.":null))&&<p role="status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notices[query.success]??(query.success.startsWith("relationship-")?"Связь сохранена.":query.success==="franchise-deleted"?"Франшиза удалена.":"Жанр сохранён.")}</p>}
  {query.error&&<p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{errors[query.error]??(query.error==="source-invalid"?"Источник не найден или его данные некорректны.":query.error==="franchise-in-use"?"Франшизу нельзя удалить: сначала отвяжи от неё тайтлы или перемести франшизу в архив.":query.error==="franchise-invalid"?"Франшиза не найдена.":query.error==="genre-in-use"?"Нельзя удалить жанр, пока он привязан к тайтлам. Сначала убери связи в разделе «Привязки жанров».":query.error==="genre-invalid"?"Проверь выбранный жанр.":"Операция не выполнена.")}</p>}
  {loadError&&<p role="alert" className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">Не удалось загрузить часть каталога. Проверь миграции и права Supabase.</p>}

  {(() => {
   const tabs = [["overview", "Обзор"], ["franchises", "Франшизы"], ["genres", "Жанры"], ["relationships", "Связи"], ["structure", "Структура"], ["sources", "Источники"], ["users", "Пользователи"], ["audit", "Журнал"]] as const;
   const activeTab = tabs.some(([id]) => id === query.tab) ? query.tab! : "overview";
   const panel = "mt-8 space-y-6";
   return <>
    <nav aria-label="Разделы админ-панели" className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
     {tabs.map(([id, label]) => <Link key={id} href={`/admin?tab=${id}`} aria-current={activeTab === id ? "page" : undefined} className={`rounded-lg px-3 py-2 transition ${activeTab === id ? "bg-violet-500 text-white" : "text-zinc-300 hover:bg-white/10 hover:text-white"}`}>{label}</Link>)}
    </nav>
    {activeTab === "overview" && <div className={panel}><div className="grid gap-5 lg:grid-cols-2">   <section className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.06] p-6"><h2 className="text-xl font-bold">Редактор тайтлов</h2><p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">Полный список с поиском и фильтрами, создание через мастер, публикация и безопасное управление записями.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/admin/titles" className={button}>Открыть редактор тайтлов</Link><Link href="/admin/titles/new" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold">+ Создать тайтл</Link><Link href="/admin/import" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold">Импорт каталога</Link><Link href="/admin/reports" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold">Жалобы и апелляции</Link></div></section></div>  <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5"><h2 className="text-2xl font-bold">Тайтлы</h2><p className="mt-2 text-sm text-zinc-400">Для поиска, изменения карточек и статуса открой единый редактор тайтлов.</p><Link href="/admin/titles" className="mt-4 inline-block text-sm text-violet-300">К списку тайтлов →</Link></section></div>}
    {activeTab === "franchises" && <div className={panel}><h2 className="text-2xl font-bold">Франшизы</h2><div className="grid gap-5 lg:grid-cols-2">   <form id="franchises" action={createFranchise} className="scroll-mt-24 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
    <h2 className="text-xl font-bold">Новая франшиза</h2>
    <label className={label}>Название<input className={field} name="name" required maxLength={160}/></label>
    <label className={label}>Slug<input className={field} name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={160} placeholder="my-franchise"/></label>
    <label className={label}>Обложка (HTTPS)<input className={field} name="cover_url" type="url" maxLength={2048}/></label>
    <label className={label}>Описание<textarea className={field} name="description" rows={3} maxLength={5000}/></label>
    <button className={button}>Создать черновик франшизы</button>
   </form>

   <FranchiseStatusForm franchises={franchises}/></div>  <section className="mt-10"><h2 className="text-2xl font-bold">Текущие франшизы</h2>{franchises.length===0?<p className="mt-3 text-sm text-zinc-400">Франшиз пока нет.</p>:<ul className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10">{franchises.map(f=><li key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{f.name}</p><p className="mt-1 text-xs text-zinc-500">{f.slug} · {f.status}</p></div>{f.status==="published"?<Link href={`/franchise/${f.slug}`} className="text-sm text-violet-300">Открыть</Link>:<span className="text-xs text-zinc-500">Не видна в каталоге</span>}</li>)}</ul>}</section></div>}
    {activeTab === "genres" && <div className={panel}><h2 className="text-2xl font-bold">Жанры</h2><div className="grid gap-5 lg:grid-cols-2">   <form action={createGenre} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
    <h2 className="text-xl font-bold">Новый жанр</h2>
    <label className={label}>Название<input className={field} name="name" required maxLength={120} placeholder="Научная фантастика"/></label>
    <label className={label}>Slug<input className={field} name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} placeholder="science-fiction"/></label>
    <button className={button}>Создать жанр</button>
   </form>

   <form action={addGenreToTitle} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
    <h2 className="text-xl font-bold">Жанр тайтла</h2>
    <label className={label}>Тайтл<TitleSelect titles={titles}/></label>
    <label className={label}>Жанр<select className={field} name="genre_id" required defaultValue=""><option value="" disabled>Выбери жанр</option>{genres.map(g=><option key={g.id} value={g.id}>{g.name} · {g.slug}</option>)}</select></label>
    <button className={button} disabled={!titles.length||!genres.length}>Привязать жанр</button>
   </form></div>  <section id="genres" className="mt-10 scroll-mt-24"><h2 className="text-2xl font-bold">Редактор жанров</h2><GenreManager genres={genres}/>
   <h3 className="mt-8 text-lg font-bold">Привязки жанров</h3>{titles.length===0?<p className="mt-3 text-sm text-zinc-400">Тайтлов пока нет.</p>:<ul className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10">{titles.map(t=>{const assigned=titleGenres.filter(x=>x.title_id===t.id);return <li key={t.id} className="p-4"><p className="font-medium">{t.name}</p>{assigned.length===0?<p className="mt-1 text-xs text-zinc-500">Жанры не назначены.</p>:<ul className="mt-2 flex flex-wrap gap-2">{assigned.map(x=>{const genre=genres.find(g=>g.id===x.genre_id);if(!genre)return null;return <li key={x.genre_id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"><span>{genre.name}</span><form action={removeGenreFromTitle}><input type="hidden" name="title_id" value={t.id}/><input type="hidden" name="genre_id" value={genre.id}/><button className="text-zinc-400 hover:text-red-300" aria-label={`Убрать жанр ${genre.name} у ${t.name}`}>×</button></form></li>;})}</ul>}</li>;})}</ul>}
  </section></div>}
    {activeTab === "relationships" && <div className={panel}><h2 className="text-2xl font-bold">Связи тайтлов</h2><div className="grid gap-5 lg:grid-cols-2">   <form action={createTitleRelationship} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
    <h2 className="text-xl font-bold">Связать произведения</h2>
    <p className="text-xs leading-5 text-zinc-500">Тип связи описывает первый тайтл относительно второго. Например: адаптация → оригинал.</p>
    <label className={label}>Первый тайтл (source)<select className={field} name="source_title_id" required defaultValue=""><option value="" disabled>Выбери тайтл</option>{titles.map(t=><option key={t.id} value={t.id}>{t.name} · {t.status}</option>)}</select></label>
    <label className={label}>Связать с (target)<select className={field} name="target_title_id" required defaultValue=""><option value="" disabled>Выбери тайтл</option>{titles.map(t=><option key={t.id} value={t.id}>{t.name} · {t.status}</option>)}</select></label>
    <label className={label}>Отношение первого тайтла ко второму<select className={field} name="relationship_type" required defaultValue="adaptation">
     <option value="adaptation">Первый — адаптация второго</option><option value="sequel">Первый — продолжение второго</option><option value="prequel">Первый — приквел к второму</option><option value="spin_off">Первый — спин-офф второго</option><option value="remake">Первый — ремейк второго</option><option value="side_story">Первый — побочная история второго</option><option value="alternative_version">Первый — альтернативная версия второго</option><option value="same_universe">Первый и второй — одна вселенная</option>
    </select></label>
    <button className={button} disabled={titles.length<2}>Добавить связь</button>
   </form>

   <section id="relationships" className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-2">
    <h2 className="text-xl font-bold">Связи тайтлов</h2>
    <p className="mt-2 text-sm text-zinc-400">Изменение типа связи и удаление не затрагивают сами тайтлы.</p>
    <RelationshipManager relationships={relationships} titleNames={Object.fromEntries(titles.map((title)=>[title.id,title.name]))}/>
   </section></div></div>}
    {activeTab === "structure" && <div className={panel}><h2 className="text-2xl font-bold">Структура произведений</h2><div className="grid gap-5 lg:grid-cols-2">   <form action={createSeason} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
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

   <form action={createEdition} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
    <h2 className="text-xl font-bold">Добавить издание</h2>
    <label className={label}>Тайтл<select className={field} name="title_id" required defaultValue=""><option value="" disabled>Выбери тайтл для чтения</option>{readingTitles.map(t=><option key={t.id} value={t.id}>{t.name} · {t.status}</option>)}</select></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className={label}>Вид<select className={field} name="edition_kind"><option value="graphic">Графическое</option><option value="text">Текстовое</option></select></label><label className={label}>Номер<input className={field} name="edition_number" type="number" min={1} max={999999} defaultValue={1} required/></label></div>
    <label className={label}>Название<input className={field} name="name" maxLength={160} required placeholder="Первое издание"/></label>
    <label className={label}>Язык<input className={field} name="language_code" maxLength={35} placeholder="ru"/></label>
    <label className={label}>Описание<textarea className={field} name="description" rows={3} maxLength={3000}/></label>
    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" name="publish" value="yes"/>Опубликовать сразу</label><button className={button} disabled={!readingTitles.length}>Добавить издание</button>
   </form>

   <form action={createVolume} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
    <h2 className="text-xl font-bold">Добавить том</h2>
    <label className={label}>Тайтл<select className={field} name="title_id" required defaultValue=""><option value="" disabled>Выбери тайтл для чтения</option>{readingTitles.map(t=><option key={t.id} value={t.id}>{t.name} · {t.status}</option>)}</select></label>
    <label className={label}>Издание (необязательно)<select className={field} name="edition_id" defaultValue=""><option value="">Без привязки к изданию</option>{editions.map(e=><option key={e.id} value={e.id}>{titleName.get(e.title_id)} · {e.name} · {e.status}</option>)}</select></label>
    <label className={label}>Номер тома<input className={field} name="volume_number" type="number" min="0.01" max="99999.99" step="0.01" required placeholder="1"/></label>
    <label className={label}>Название (необязательно)<input className={field} name="name" maxLength={160}/></label>
    <label className={label}>Описание<textarea className={field} name="description" rows={3} maxLength={3000}/></label>
    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" name="publish" value="yes"/>Опубликовать сразу</label><button className={button} disabled={!readingTitles.length}>Добавить том</button>
   </form></div>  <div id="structure" className="scroll-mt-24"><StructureEditor editions={editions} volumes={volumes} titles={readingTitles}/>
  <UnitsEditor titles={titles} videoTitles={videoTitles} readingTitles={readingTitles} seasons={seasons} episodes={episodes} chapters={chapters}/></div>  <section className="mt-10 grid gap-8 lg:grid-cols-2">
   <div><h2 className="text-2xl font-bold">Издания</h2>{editions.length===0?<p className="mt-3 text-sm text-zinc-400">Изданий пока нет.</p>:<ul className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10">{editions.map(e=><li key={e.id} className="p-4"><p className="font-medium">{titleName.get(e.title_id)} · {e.name}</p><p className="mt-1 text-xs text-zinc-500">{e.edition_kind} · №{e.edition_number}{e.language_code?` · ${e.language_code}`:""} · {e.status}</p></li>)}</ul>}</div>
   <div><h2 className="text-2xl font-bold">Тома</h2>{volumes.length===0?<p className="mt-3 text-sm text-zinc-400">Томов пока нет.</p>:<ul className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10">{volumes.map(v=><li key={v.id} className="p-4"><p className="font-medium">{titleName.get(v.title_id)} · {v.name||`Том ${v.volume_number}`}</p><p className="mt-1 text-xs text-zinc-500">{v.edition_id?editions.find(e=>e.id===v.edition_id)?.name||"Издание":"Без отдельного издания"} · {v.status}</p></li>)}</ul>}</div>
  </section></div>}
    {activeTab === "sources" && <div className={panel}><h2 className="text-2xl font-bold">Источники</h2>  <section className="mt-8 grid gap-5 lg:grid-cols-2">
   <form action={addVideoSource} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
    <h2 className="text-xl font-bold">Разрешённый видеоисточник</h2><label className={label}>Тайтл<TitleSelect titles={titles}/></label>
    <label className={label}>Серия (необязательно)<select className={field} name="episode_id"><option value="">На уровне тайтла</option>{episodes.map(e=><option key={e.id} value={e.id}>{titleName.get(e.title_id)} · серия {e.episode_number}{e.name?` · ${e.name}`:""} · {e.status==="published"&&(!e.season_id||seasons.some((season)=>season.id===e.season_id&&season.status==="published"))?"Опубликована":"Черновик"}</option>)}</select></label>
    <label className={label}>Ссылка HTTPS<input className={field} name="source_url" type="url" required/></label>
    <p className="-mt-3 break-all text-xs leading-5 text-zinc-500">Для embed вставляй адрес src плеера, а не полный iframe. RuTube: https://rutube.ru/play/embed/c122b6d3f69a3e34ea22d0427dc40174/</p>
    <label className={label}>Формат<select className={field} name="source_format"><option value="hls">hls</option><option value="dash">dash</option><option value="mp4">mp4</option><option value="embed">embed (RuTube, YouTube NoCookie, Vimeo)</option></select></label>
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
  </section>  <section id="sources" className="mt-8 scroll-mt-24 grid gap-5 lg:grid-cols-2"><SourceManager title="Видеоисточники" items={video} kind="video"/><SourceManager title="Источники чтения" items={reading} kind="reading"/></section></div>}
    {activeTab === "users" && <div className={panel}><h2 className="text-2xl font-bold">Пользователи и модерация</h2>  <section id="moderation" className="mt-10 scroll-mt-24"><h2 className="text-2xl font-bold">Модерация публичных профилей</h2><p className="mt-2 text-sm text-zinc-400">Ограничение скрывает профиль и блокирует повторное включение публичности владельцем. После снятия ограничения профиль остаётся приватным.</p><ProfileModerationForm profiles={moderationProfiles}/></section>
  <section id="roles" className="mt-10 scroll-mt-24"><h2 className="text-2xl font-bold">Администраторы</h2><p className="mt-2 text-sm text-zinc-400">Роль даёт полный доступ к управлению каталогом и модерации. Назначай её только доверенным пользователям. Свою роль и роль последнего администратора изменить нельзя.</p>
   {!authUsers&&<p role="alert" className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">{authUsersResult.error==="missing-config"?"Добавь SUPABASE_SERVICE_ROLE_KEY в серверные переменные окружения. Не используй префикс NEXT_PUBLIC_.":"Не удалось безопасно загрузить пользователей; управление ролями отключено."}</p>}
   {authUsers&&<UserRoleForm users={authUsers} currentUserId={user.id}/>}
   <h3 className="mt-8 text-lg font-semibold">Журнал назначения ролей</h3>
   {roleAuditRes.error?<p className="mt-3 text-sm text-zinc-500">Для журнала примени миграцию 018.</p>:roleAuditEntries.length===0?<p className="mt-3 text-sm text-zinc-500">Записей о смене ролей пока нет.</p>:<ul className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10">{roleAuditEntries.map((entry)=><li key={entry.id} className="p-4 text-sm"><p className="font-medium">{entry.target_email||`Пользователь ${entry.id.slice(0,8)}`} · {entry.previous_role||"без роли"} → {entry.next_role||"без роли"}</p><p className="mt-1 text-xs text-zinc-500">{entry.outcome==="succeeded"?"Успешно":entry.outcome==="failed"?`Ошибка: ${entry.failure_message||"неизвестно"}`:"Операция начата"} · инициатор {entry.actor_id.slice(0,8)} · {new Date(entry.created_at).toLocaleString("ru-RU")}</p></li>)}</ul>}
  </section></div>}
    {activeTab === "audit" && <div className={panel}><h2 className="text-2xl font-bold">Журнал изменений</h2>  <section id="audit-log" className="mt-10 scroll-mt-24"><h2 className="text-2xl font-bold">Журнал изменений</h2><p className="mt-2 text-sm text-zinc-400">Последние 100 операций в каталоге и профилях.</p>{auditEntries.length===0?<p className="mt-3 rounded-xl border border-white/10 p-4 text-sm text-zinc-500">Записей пока нет.</p>:<ul className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10">{auditEntries.map(entry=>{const row=entry.after_data??entry.before_data??{};const labelValue=[row.name,row.display_name,row.username,row.slug,row.chapter_label,row.episode_number,row.season_number,row.volume_number].find(value=>value!==undefined&&value!==null);const actionLabel=entry.action==="insert"?"Создание":entry.action==="update"?"Изменение":"Удаление";const tableLabel:Record<string,string>={franchises:"Франшиза",titles:"Тайтл",title_relationships:"Связь",genres:"Жанр",title_genres:"Жанр тайтла",title_seasons:"Сезон",title_episodes:"Серия",title_editions:"Издание",title_volumes:"Том",title_chapters:"Глава",video_sources:"Видеоисточник",reading_sources:"Источник чтения",profiles:"Профиль"};return <li key={entry.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{actionLabel}: {tableLabel[entry.entity_table]??entry.entity_table}{labelValue!==undefined?` · ${String(labelValue)}`:""}</p><p className="mt-1 text-xs text-zinc-500">{entry.title_id?titleName.get(entry.title_id)||`Тайтл ${entry.title_id.slice(0,8)}`:"Без привязки к тайтлу"} · {entry.actor_id?`пользователь ${entry.actor_id.slice(0,8)}`:"системная операция"}</p></div><time className="text-xs text-zinc-500">{new Date(entry.created_at).toLocaleString("ru-RU")}</time></div><details className="mt-3 text-xs text-violet-300"><summary className="cursor-pointer">Показать данные до/после</summary><div className="mt-3 grid gap-3 md:grid-cols-2"><div><p className="mb-1 text-zinc-400">До</p><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/30 p-3 text-zinc-300">{entry.before_data?JSON.stringify(entry.before_data,null,2):"—"}</pre></div><div><p className="mb-1 text-zinc-400">После</p><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/30 p-3 text-zinc-300">{entry.after_data?JSON.stringify(entry.after_data,null,2):"—"}</pre></div></div></details></li>;})}</ul>}</section></div>}
   </>;
  })()}

 </div></main>;
}


export default function AdminPage({searchParams}:Props){
 return <Suspense fallback={<main className="min-h-screen bg-background p-8 text-white"><p>Загружаем управление каталогом…</p></main>}>
  <AdminContent searchParams={searchParams}/>
 </Suspense>;
}
