"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const types = ["anime","movie","series","drama","cartoon","manga","manhwa","manhua","light_novel","web_novel","book"];
const videoTypes = ["anime","movie","series","drama","cartoon"];
const readingTypes = ["manga","manhwa","manhua","light_novel","web_novel","book"];
async function admin() {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect("/login?next=%2Fadmin");
  if (user.app_metadata?.role !== "catalog_admin") redirect("/");
  return db;
}
async function ensureType(db: Awaited<ReturnType<typeof createClient>>, id: string, allowed: string[]) {
  const {data,error}=await db.from("titles").select("content_type").eq("id",id).maybeSingle();
  if(error||!data||!allowed.includes(data.content_type))fail();
}
function val(fd: FormData, key: string, max=500) {
  const v=fd.get(key); return typeof v==="string" ? v.trim().slice(0,max) : "";
}
function fail(code="invalid"): never { redirect("/admin?error="+encodeURIComponent(code)); }
function success(code: string): never {
  revalidatePath("/admin"); revalidatePath("/catalog"); revalidatePath("/");
  redirect("/admin?success="+encodeURIComponent(code));
}
function secureUrl(v: string) {
  if (v.length>2048) return false;
  try { const u=new URL(v); return u.protocol==="https:" && !!u.hostname && !u.username && !u.password; } catch { return false; }
}
function isUuid(v: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v); }

export async function createTitle(fd: FormData) {
  const db=await admin(), name=val(fd,"name",160), slug=val(fd,"slug",160).toLowerCase();
  const type=val(fd,"content_type",30), description=val(fd,"description",5000), cover=val(fd,"cover_url",2048);
  const rawYear=val(fd,"release_year",4), year=rawYear ? Number(rawYear) : null;
  if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !types.includes(type)) fail();
  if (rawYear && (!Number.isInteger(year) || year!<1800 || year!>2200)) fail();
  if (cover && !secureUrl(cover)) fail();
  const {error}=await db.from("titles").insert({name,slug,content_type:type,description:description||null,cover_url:cover||null,release_year:year,status:"draft"});
  if(error){console.error("[admin] create title:",error.message);fail("save");}
  success("title-created");
}

export async function setTitleStatus(fd: FormData) {
  const db=await admin(), id=val(fd,"title_id",36), status=val(fd,"status",16), slug=val(fd,"slug",160);
  const normalizedSlug=slug.toLowerCase();
  if(!isUuid(id)||!["draft","published","archived"].includes(status)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug))fail();
  const {data:current,error:lookupError}=await db.from("titles").select("slug").eq("id",id).maybeSingle();
  if(lookupError||!current)fail("save");
  const {error}=await db.from("titles").update({status,slug:normalizedSlug}).eq("id",id);
  if(error?.code==="23505")fail("slug-taken");
  if(error){console.error("[admin] title status:",error.message);fail("save");}
  revalidatePath("/admin");revalidatePath("/catalog");revalidatePath("/");
  revalidatePath("/title/"+current.slug);revalidatePath("/title/"+normalizedSlug);
  redirect("/admin?success=title-updated");
}

export async function createSeason(fd: FormData) {
  const db=await admin(), title_id=val(fd,"title_id",36), n=Number(val(fd,"season_number",4)), name=val(fd,"name",160);
  if(!isUuid(title_id)||!Number.isInteger(n)||n<1||n>9999)fail();
  await ensureType(db,title_id,videoTypes);
  const {error}=await db.from("title_seasons").insert({title_id,season_number:n,name:name||null,status:fd.get("publish")==="yes"?"published":"draft"});
  if(error){console.error("[admin] season:",error.message);fail("save");} success("season-created");
}

export async function createEpisode(fd: FormData) {
  const db=await admin(), title_id=val(fd,"title_id",36), season_id=val(fd,"season_id",36), n=Number(val(fd,"episode_number",12)), name=val(fd,"name",160);
  if(!isUuid(title_id)||!Number.isFinite(n)||n<=0||n>99999||(season_id&&!isUuid(season_id)))fail();
  await ensureType(db,title_id,videoTypes);
  const {error}=await db.from("title_episodes").insert({title_id,season_id:season_id||null,episode_number:n,sort_order:Math.max(1,Math.round(n*100)),name:name||null,status:fd.get("publish")==="yes"?"published":"draft"});
  if(error){console.error("[admin] episode:",error.message);fail("save");} success("episode-created");
}

export async function createChapter(fd: FormData) {
  const db=await admin(), title_id=val(fd,"title_id",36), chapter_label=val(fd,"chapter_label",80), name=val(fd,"name",160), sort_order=Number(val(fd,"sort_order",8));
  if(!isUuid(title_id)||!chapter_label||!Number.isInteger(sort_order)||sort_order<1||sort_order>99999999)fail();
  await ensureType(db,title_id,readingTypes);
  const {error}=await db.from("title_chapters").insert({title_id,chapter_label,chapter_number:/^\\d+(?:\\.\\d+)?$/.test(chapter_label)?Number(chapter_label):null,sort_order,name:name||null,status:fd.get("publish")==="yes"?"published":"draft"});
  if(error){console.error("[admin] chapter:",error.message);fail("save");} success("chapter-created");
}

export async function addVideoSource(fd: FormData) {
  const db=await admin(), title_id=val(fd,"title_id",36), episode_id=val(fd,"episode_id",36), source_url=val(fd,"source_url",2048);
  const source_format=val(fd,"source_format",20), provider_name=val(fd,"provider_name",120), language_code=val(fd,"language_code",35), quality_label=val(fd,"quality_label",80);
  if(!isUuid(title_id)||(episode_id&&!isUuid(episode_id))||!secureUrl(source_url)||!["hls","dash","mp4","embed"].includes(source_format))fail();
  await ensureType(db,title_id,videoTypes);
  if(fd.get("rights_confirmed")!=="yes")fail("rights");
  if(episode_id){const {data,error}=await db.from("title_episodes").select("id").eq("id",episode_id).eq("title_id",title_id).maybeSingle();if(error||!data)fail();}
  const {error}=await db.from("video_sources").insert({title_id,episode_id:episode_id||null,source_url,source_format,provider_name:provider_name||null,language_code:language_code||null,quality_label:quality_label||null,availability_status:"available",rights_status:"approved",publication_status:"published",reviewed_at:new Date().toISOString()});
  if(error){console.error("[admin] video source:",error.message);fail("save");} success("video-source-added");
}

export async function addReadingSource(fd: FormData) {
  const db=await admin(), title_id=val(fd,"title_id",36), chapter_id=val(fd,"chapter_id",36), source_url=val(fd,"source_url",2048);
  const source_format=val(fd,"source_format",30), provider_name=val(fd,"provider_name",120), language_code=val(fd,"language_code",35);
  if(!isUuid(title_id)||(chapter_id&&!isUuid(chapter_id))||!secureUrl(source_url)||!["image_pages","pdf","epub","html","plain_text"].includes(source_format))fail();
  await ensureType(db,title_id,readingTypes);
  if(fd.get("rights_confirmed")!=="yes")fail("rights");
  if(chapter_id){const {data,error}=await db.from("title_chapters").select("id").eq("id",chapter_id).eq("title_id",title_id).maybeSingle();if(error||!data)fail();}
  const {error}=await db.from("reading_sources").insert({title_id,chapter_id:chapter_id||null,source_url,source_format,provider_name:provider_name||null,language_code:language_code||null,availability_status:"available",rights_status:"approved",publication_status:"published",reviewed_at:new Date().toISOString()});
  if(error){console.error("[admin] reading source:",error.message);fail("save");} success("reading-source-added");
}
