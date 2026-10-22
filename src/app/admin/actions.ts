"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listAuthUsers } from "@/lib/supabase/admin-users";

const types = ["anime","movie","series","drama","cartoon","manga","manhwa","manhua","light_novel","web_novel","book"];
const videoTypes = ["anime","movie","series","drama","cartoon"];
const readingTypes = ["manga","manhwa","manhua","light_novel","web_novel","book"];
const relationshipTypes = ["adaptation","sequel","prequel","spin_off","remake","side_story","alternative_version","same_universe"];
async function admin() {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect("/login?next=%2Fadmin");
  if (user.app_metadata?.role !== "catalog_admin") redirect("/");
  return db;
}
async function ensureType(db: Awaited<ReturnType<typeof createClient>>, id: string, allowed: string[]): Promise<string> {
  const {data,error}=await db.from("titles").select("content_type,slug").eq("id",id).maybeSingle();
  if(error||!data||!allowed.includes(data.content_type))fail();
  return data.slug;
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
function supportedVideoEmbedUrl(v: string) {
  try {
    const url = new URL(v);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    if (url.hostname === "www.youtube-nocookie.com" && /^\/embed\/[\w-]{6,}$/.test(url.pathname)) return true;
    if (url.hostname === "player.vimeo.com" && /^\/video\/\d+$/.test(url.pathname)) return true;
    return (url.hostname === "rutube.ru" || url.hostname === "www.rutube.ru") && /^\/play\/embed\/[a-f\d]{32}\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}
function isUuid(v: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v); }

export async function createTitle(fd: FormData) {
  const db=await admin(), name=val(fd,"name",160), slug=val(fd,"slug",160).toLowerCase();
  const franchise_id=val(fd,"franchise_id",36);
  const type=val(fd,"content_type",30), description=val(fd,"description",5000), cover=val(fd,"cover_url",2048);
  const rawYear=val(fd,"release_year",4), year=rawYear ? Number(rawYear) : null;
  if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !types.includes(type)) fail();
  if (franchise_id && !isUuid(franchise_id)) fail();
  if (franchise_id) {
    const {data:franchise,error:franchiseError}=await db.from("franchises").select("id").eq("id",franchise_id).maybeSingle();
    if(franchiseError||!franchise)fail();
  }
  if (rawYear && (!Number.isInteger(year) || year!<1800 || year!>2200)) fail();
  if (cover && !secureUrl(cover)) fail();
  const {error}=await db.from("titles").insert({name,slug,franchise_id:franchise_id||null,content_type:type,description:description||null,cover_url:cover||null,release_year:year,status:"draft"});
  if(error){console.error("[admin] create title:",error.message);fail("save");}
  success("title-created");
}

export async function createFranchise(fd: FormData) {
  const db=await admin(), name=val(fd,"name",160), slug=val(fd,"slug",160).toLowerCase();
  const description=val(fd,"description",5000), cover_url=val(fd,"cover_url",2048);
  if(!name||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))fail();
  if(cover_url&&!secureUrl(cover_url))fail();
  const {error}=await db.from("franchises").insert({name,slug,description:description||null,cover_url:cover_url||null,status:"draft"});
  if(error?.code==="23505")fail("franchise-slug-taken");
  if(error){console.error("[admin] create franchise:",error.message);fail("save");}
  success("franchise-created");
}

export async function createGenre(fd: FormData) {
  const db=await admin(), name=val(fd,"name",120), slug=val(fd,"slug",120).toLowerCase();
  if(!name||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))fail();
  const {error}=await db.from("genres").insert({name,slug});
  if(error?.code==="23505")fail("genre-duplicate");
  if(error){console.error("[admin] create genre:",error.message);fail("save");}
  success("genre-created");
}

export async function updateGenre(fd: FormData) {
  const db = await admin();
  const id = val(fd, "genre_id", 36), name = val(fd, "name", 120), slug = val(fd, "slug", 120).toLowerCase();
  if (!isUuid(id) || !name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail("genre-invalid");
  const { data: current, error: lookupError } = await db.from("genres").select("id").eq("id", id).maybeSingle();
  if (lookupError || !current) fail("genre-invalid");
  const { error } = await db.from("genres").update({ name, slug }).eq("id", id);
  if (error?.code === "23505") fail("genre-duplicate");
  if (error) { console.error("[admin] update genre:", error.message); fail("save"); }
  revalidatePath("/catalog");
  success("genre-updated");
}

export async function deleteGenre(fd: FormData) {
  const db = await admin();
  const id = val(fd, "genre_id", 36);
  if (!isUuid(id)) fail("genre-invalid");
  const { data: current, error: lookupError } = await db.from("genres").select("id").eq("id", id).maybeSingle();
  if (lookupError || !current) fail("genre-invalid");
  const { count, error: countError } = await db.from("title_genres").select("title_id", { count: "exact", head: true }).eq("genre_id", id);
  if (countError) fail("save");
  if (count) fail("genre-in-use");
  const { error } = await db.from("genres").delete().eq("id", id);
  if (error) { console.error("[admin] delete genre:", error.message); fail("save"); }
  revalidatePath("/catalog");
  success("genre-deleted");
}

export async function addGenreToTitle(fd: FormData) {
  const db=await admin(), title_id=val(fd,"title_id",36), genre_id=val(fd,"genre_id",36);
  if(!isUuid(title_id)||!isUuid(genre_id))fail("genre-invalid");
  const [titleResult,genreResult]=await Promise.all([
    db.from("titles").select("slug").eq("id",title_id).maybeSingle(),
    db.from("genres").select("id").eq("id",genre_id).maybeSingle(),
  ]);
  if(titleResult.error||genreResult.error||!titleResult.data||!genreResult.data)fail("genre-invalid");
  const {error}=await db.from("title_genres").insert({title_id,genre_id});
  if(error?.code==="23505")fail("genre-already-assigned");
  if(error){console.error("[admin] assign genre:",error.message);fail("save");}
  revalidatePath("/title/"+titleResult.data.slug);
  success("genre-assigned");
}

export async function removeGenreFromTitle(fd: FormData) {
  const db=await admin(), title_id=val(fd,"title_id",36), genre_id=val(fd,"genre_id",36);
  if(!isUuid(title_id)||!isUuid(genre_id))fail("genre-invalid");
  const {data:title,error:titleError}=await db.from("titles").select("slug").eq("id",title_id).maybeSingle();
  if(titleError||!title)fail("genre-invalid");
  const {error}=await db.from("title_genres").delete().eq("title_id",title_id).eq("genre_id",genre_id);
  if(error){console.error("[admin] remove title genre:",error.message);fail("save");}
  revalidatePath("/title/"+title.slug);
  success("genre-removed");
}

export async function setProfileModeration(fd: FormData) {
  const db=await admin(), user_id=val(fd,"user_id",36), suspend=val(fd,"suspend",5)==="true", reason=val(fd,"reason",500);
  if(!isUuid(user_id)||(!suspend&&val(fd,"suspend",5)!=="false")||(suspend&&!reason))fail("profile-moderation-invalid");
  const {error}=await db.rpc("admin_set_profile_moderation",{target_user_id:user_id,suspend_profile:suspend,reason_text:reason||null});
  if(error){console.error("[admin] profile moderation:",error.message);fail("profile-moderation-failed");}
  revalidatePath("/u/[username]","page");
  success(suspend?"profile-suspended":"profile-restored");
}

export async function setCatalogAdminRole(fd: FormData) {
  const db = await admin();
  const { data: { user: actor } } = await db.auth.getUser();
  if (!actor) redirect("/login?next=%2Fadmin");

  const userId = val(fd, "user_id", 36);
  const nextRole = val(fd, "role", 32);
  if (!isUuid(userId) || !["catalog_admin", "user"].includes(nextRole) || userId === actor.id) fail("role-invalid");

  const { admin: adminApi, users, error: listError } = await listAuthUsers();
  if (!adminApi) fail("role-admin-key-missing");
  if (!users) fail(listError === "too-many-users" ? "role-user-limit" : "role-users-load-failed");

  const target = users.find((candidate) => candidate.id === userId);
  if (!target) fail("role-user-not-found");
  const previousRole = typeof target.app_metadata.role === "string" ? target.app_metadata.role : null;
  const demoting = previousRole === "catalog_admin" && nextRole !== "catalog_admin";
  if (demoting && users.filter((candidate) => candidate.app_metadata.role === "catalog_admin").length <= 1) fail("role-last-admin");

  const newRole = nextRole === "catalog_admin" ? "catalog_admin" : null;
  const { data: audit, error: auditInsertError } = await adminApi.from("admin_role_audit_log").insert({
    actor_id: actor.id,
    target_user_id: target.id,
    target_email: target.email ?? null,
    previous_role: previousRole,
    next_role: newRole,
  }).select("id").single();
  if (auditInsertError || !audit) {
    console.error("[admin] role audit start:", auditInsertError?.message ?? "missing audit row");
    fail("role-audit-unavailable");
  }

  const appMetadata = { ...target.app_metadata };
  if (newRole) appMetadata.role = newRole;
  else delete appMetadata.role;
  const { error: updateError } = await adminApi.auth.admin.updateUserById(target.id, { app_metadata: appMetadata });
  if (updateError) {
    const { error: auditError } = await adminApi.from("admin_role_audit_log").update({ outcome: "failed", failure_message: updateError.message.slice(0, 300), completed_at: new Date().toISOString() }).eq("id", audit.id);
    if (auditError) console.error("[admin] role audit result:", auditError.message);
    console.error("[admin] role update:", updateError.message);
    fail("role-update-failed");
  }

  const { error: auditUpdateError } = await adminApi.from("admin_role_audit_log").update({ outcome: "succeeded", completed_at: new Date().toISOString() }).eq("id", audit.id);
  revalidatePath("/admin");
  redirect(`/admin?success=${auditUpdateError ? "role-updated-audit-warning" : newRole ? "role-granted" : "role-revoked"}`);
}

export async function setFranchiseStatus(fd: FormData) {
  const db=await admin(), id=val(fd,"franchise_id",36), status=val(fd,"status",16), slug=val(fd,"slug",160).toLowerCase();
  const name=val(fd,"name",160), description=val(fd,"description",5000), cover_url=val(fd,"cover_url",2048);
  if(!isUuid(id)||!name||!["draft","published","archived"].includes(status)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))fail();
  if(cover_url&&!secureUrl(cover_url))fail();
  const {data:current,error:lookupError}=await db.from("franchises").select("slug").eq("id",id).maybeSingle();
  if(lookupError||!current)fail("save");
  const {error}=await db.from("franchises").update({name,description:description||null,cover_url:cover_url||null,status,slug,updated_at:new Date().toISOString()}).eq("id",id);
  if(error?.code==="23505")fail("franchise-slug-taken");
  if(error){console.error("[admin] franchise status:",error.message);fail("save");}
  revalidatePath("/admin");revalidatePath("/catalog");revalidatePath("/");
  revalidatePath("/franchise/"+current.slug);revalidatePath("/franchise/"+slug);
  redirect("/admin?success=franchise-updated");
}

export async function deleteFranchise(fd: FormData) {
  const db = await admin();
  const id = val(fd, "franchise_id", 36);
  if (!isUuid(id)) fail("franchise-invalid");
  const { data: franchise, error: lookupError } = await db.from("franchises").select("slug").eq("id", id).maybeSingle();
  if (lookupError || !franchise) fail("franchise-invalid");
  const { count, error: countError } = await db.from("titles").select("id", { count: "exact", head: true }).eq("franchise_id", id);
  if (countError) fail("save");
  if (count) fail("franchise-in-use");
  const { error } = await db.from("franchises").delete().eq("id", id);
  if (error) { console.error("[admin] delete franchise:", error.message); fail("save"); }
  revalidatePath("/franchise/" + franchise.slug);
  success("franchise-deleted");
}

export async function createTitleRelationship(fd: FormData) {
  const db=await admin(), source_title_id=val(fd,"source_title_id",36), target_title_id=val(fd,"target_title_id",36);
  const relationship_type=val(fd,"relationship_type",32);
  if(!isUuid(source_title_id)||!isUuid(target_title_id)||source_title_id===target_title_id||!relationshipTypes.includes(relationship_type))fail("relationship-invalid");
  const [sourceResult,targetResult]=await Promise.all([
    db.from("titles").select("slug").eq("id",source_title_id).maybeSingle(),
    db.from("titles").select("slug").eq("id",target_title_id).maybeSingle(),
  ]);
  if(sourceResult.error||targetResult.error||!sourceResult.data||!targetResult.data)fail("relationship-invalid");
  const [directDuplicate,reverseSymmetricDuplicate]=await Promise.all([
    db.from("title_relationships").select("id").eq("source_title_id",source_title_id).eq("target_title_id",target_title_id).eq("relationship_type",relationship_type).maybeSingle(),
    relationship_type==="same_universe"
      ? db.from("title_relationships").select("id").eq("source_title_id",target_title_id).eq("target_title_id",source_title_id).eq("relationship_type",relationship_type).maybeSingle()
      : Promise.resolve({data:null,error:null}),
  ]);
  if(directDuplicate.error||reverseSymmetricDuplicate.error)fail("save");
  if(directDuplicate.data||reverseSymmetricDuplicate.data)fail("relationship-duplicate");
  const {error}=await db.from("title_relationships").insert({source_title_id,target_title_id,relationship_type});
  if(error?.code==="23505")fail("relationship-duplicate");
  if(error){console.error("[admin] title relationship:",error.message);fail("save");}
  revalidatePath("/title/"+sourceResult.data.slug);
  revalidatePath("/title/"+targetResult.data.slug);
  success("relationship-created");
}

export async function updateTitleRelationship(fd: FormData) {
  const db = await admin();
  const id = val(fd, "relationship_id", 36);
  const relationship_type = val(fd, "relationship_type", 32);
  if (!isUuid(id) || !relationshipTypes.includes(relationship_type)) fail("relationship-invalid");
  const { data: current, error: lookupError } = await db.from("title_relationships")
    .select("source_title_id,target_title_id").eq("id", id).maybeSingle();
  if (lookupError || !current) fail("relationship-invalid");
  const [sourceResult, targetResult] = await Promise.all([
    db.from("titles").select("slug").eq("id", current.source_title_id).maybeSingle(),
    db.from("titles").select("slug").eq("id", current.target_title_id).maybeSingle(),
  ]);
  if (sourceResult.error || targetResult.error || !sourceResult.data || !targetResult.data) fail("relationship-invalid");
  const { data: duplicate, error: duplicateError } = await db.from("title_relationships").select("id")
    .eq("source_title_id", current.source_title_id).eq("target_title_id", current.target_title_id)
    .eq("relationship_type", relationship_type).neq("id", id).maybeSingle();
  if (duplicateError) fail("save");
  if (duplicate) fail("relationship-duplicate");
  if (relationship_type === "same_universe") {
    const { data: reverseDuplicate, error: reverseError } = await db.from("title_relationships").select("id")
      .eq("source_title_id", current.target_title_id).eq("target_title_id", current.source_title_id)
      .eq("relationship_type", relationship_type).neq("id", id).maybeSingle();
    if (reverseError) fail("save");
    if (reverseDuplicate) fail("relationship-duplicate");
  }
  const { error } = await db.from("title_relationships").update({ relationship_type }).eq("id", id);
  if (error) { console.error("[admin] update relationship:", error.message); fail("save"); }
  revalidatePath("/title/" + sourceResult.data.slug);
  revalidatePath("/title/" + targetResult.data.slug);
  success("relationship-updated");
}

export async function deleteTitleRelationship(fd: FormData) {
  const db = await admin();
  const id = val(fd, "relationship_id", 36);
  if (!isUuid(id)) fail("relationship-invalid");
  const { data: current, error: lookupError } = await db.from("title_relationships")
    .select("source_title_id,target_title_id").eq("id", id).maybeSingle();
  if (lookupError || !current) fail("relationship-invalid");
  const [sourceResult, targetResult] = await Promise.all([
    db.from("titles").select("slug").eq("id", current.source_title_id).maybeSingle(),
    db.from("titles").select("slug").eq("id", current.target_title_id).maybeSingle(),
  ]);
  const { error } = await db.from("title_relationships").delete().eq("id", id);
  if (error) { console.error("[admin] delete relationship:", error.message); fail("save"); }
  if (sourceResult.data) revalidatePath("/title/" + sourceResult.data.slug);
  if (targetResult.data) revalidatePath("/title/" + targetResult.data.slug);
  success("relationship-deleted");
}

export async function updateTitle(fd: FormData) {
  const db=await admin(), id=val(fd,"title_id",36), status=val(fd,"status",16), slug=val(fd,"slug",160).toLowerCase();
  const name=val(fd,"name",160), original_name=val(fd,"original_name",200), content_type=val(fd,"content_type",30);
  const description=val(fd,"description",5000), cover_url=val(fd,"cover_url",2048), banner_url=val(fd,"banner_url",2048);
  const franchise_id=val(fd,"franchise_id",36), rawYear=val(fd,"release_year",4), release_year=rawYear?Number(rawYear):null;
  if(!isUuid(id)||!name||!types.includes(content_type)||!["draft","published","archived"].includes(status)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))fail();
  if(rawYear&&(!Number.isInteger(release_year)||release_year!<1800||release_year!>2200))fail();
  if(franchise_id&&!isUuid(franchise_id))fail();
  if((cover_url&&!secureUrl(cover_url))||(banner_url&&!secureUrl(banner_url)))fail();
  if(franchise_id){const {data:franchise,error}=await db.from("franchises").select("id").eq("id",franchise_id).maybeSingle();if(error||!franchise)fail();}
  const {data:current,error:lookupError}=await db.from("titles").select("slug").eq("id",id).maybeSingle();
  if(lookupError||!current)fail("save");
  const {error}=await db.from("titles").update({name,original_name:original_name||null,slug,status,content_type,release_year,franchise_id:franchise_id||null,description:description||null,cover_url:cover_url||null,banner_url:banner_url||null,updated_at:new Date().toISOString()}).eq("id",id);
  if(error?.code==="23505")fail("slug-taken");
  if(error){console.error("[admin] update title:",error.message);fail("save");}
  revalidatePath("/admin");revalidatePath("/catalog");revalidatePath("/");
  revalidatePath("/title/"+current.slug);revalidatePath("/title/"+slug);
  redirect("/admin?success=title-updated");
}

export async function createSeason(fd: FormData) {
  const db=await admin(), title_id=val(fd,"title_id",36), n=Number(val(fd,"season_number",4)), name=val(fd,"name",160);
  if(!isUuid(title_id)||!Number.isInteger(n)||n<1||n>9999)fail();
  const titleSlug=await ensureType(db,title_id,videoTypes);
  const {error}=await db.from("title_seasons").insert({title_id,season_number:n,name:name||null,status:fd.get("publish")==="yes"?"published":"draft"});
  if(error?.code==="23505")fail("season-duplicate");
  if(error){console.error("[admin] season:",error.message);fail("save");} revalidatePath("/title/"+titleSlug);success("season-created");
}

export async function updateSeason(fd: FormData) {
  const db=await admin(), id=val(fd,"season_id",36), season_number=Number(val(fd,"season_number",4)), name=val(fd,"name",160), description=val(fd,"description",3000), status=val(fd,"status",16);
  if(!isUuid(id)||!Number.isInteger(season_number)||season_number<1||season_number>9999||!['draft','published','archived'].includes(status))fail("season-invalid");
  const {data:current,error:lookupError}=await db.from("title_seasons").select("title_id").eq("id",id).maybeSingle();
  if(lookupError||!current)fail("season-invalid");
  const titleSlug=await ensureType(db,current.title_id,videoTypes);
  const {error}=await db.from("title_seasons").update({season_number,name:name||null,description:description||null,status,updated_at:new Date().toISOString()}).eq("id",id);
  if(error?.code==="23505")fail("season-duplicate");
  if(error){console.error("[admin] update season:",error.message);fail("save");}
  revalidatePath("/title/"+titleSlug);success("season-updated");
}

export async function createEpisode(fd: FormData) {
  const db=await admin(), title_id=val(fd,"title_id",36), season_id=val(fd,"season_id",36), n=Number(val(fd,"episode_number",12)), name=val(fd,"name",160);
  if(!isUuid(title_id)||!Number.isFinite(n)||n<=0||n>99999.99||Math.round(n*100)!==n*100||(season_id&&!isUuid(season_id)))fail();
  const titleSlug=await ensureType(db,title_id,videoTypes);
  if(season_id){const {data,error}=await db.from("title_seasons").select("id").eq("id",season_id).eq("title_id",title_id).maybeSingle();if(error||!data)fail();}
  const {error}=await db.from("title_episodes").insert({title_id,season_id:season_id||null,episode_number:n,sort_order:Math.max(1,Math.round(n*100)),name:name||null,status:fd.get("publish")==="yes"?"published":"draft"});
  if(error?.code==="23505")fail("episode-duplicate");
  if(error){console.error("[admin] episode:",error.message);fail("save");} revalidatePath("/title/"+titleSlug);success("episode-created");
}

export async function updateEpisode(fd: FormData) {
  const db=await admin(), id=val(fd,"episode_id",36), rawNumber=val(fd,"episode_number",10), episode_number=Number(rawNumber);
  const sort_order=Number(val(fd,"sort_order",8)), name=val(fd,"name",160), description=val(fd,"description",3000), rawDuration=val(fd,"duration_seconds",12), duration_seconds=rawDuration?Number(rawDuration):null, release_date=val(fd,"release_date",10), status=val(fd,"status",16);
  if(!isUuid(id)||!Number.isFinite(episode_number)||episode_number<=0||episode_number>99999.99||Math.round(episode_number*100)!==episode_number*100||!Number.isInteger(sort_order)||sort_order<1||sort_order>99999999||(rawDuration&&(!Number.isInteger(duration_seconds)||duration_seconds!<1||duration_seconds!>2147483647))||(release_date&&!/^\d{4}-\d{2}-\d{2}$/.test(release_date))||!['draft','published','archived'].includes(status))fail("episode-invalid");
  const {data:current,error:lookupError}=await db.from("title_episodes").select("title_id").eq("id",id).maybeSingle();
  if(lookupError||!current)fail("episode-invalid");
  const titleSlug=await ensureType(db,current.title_id,videoTypes);
  const {error}=await db.from("title_episodes").update({episode_number,sort_order,name:name||null,description:description||null,duration_seconds,release_date:release_date||null,status,updated_at:new Date().toISOString()}).eq("id",id);
  if(error?.code==="23505")fail("episode-duplicate");
  if(error){console.error("[admin] update episode:",error.message);fail("save");}
  revalidatePath("/title/"+titleSlug);success("episode-updated");
}

export async function createChapter(fd: FormData) {
  const db=await admin(), title_id=val(fd,"title_id",36), chapter_label=val(fd,"chapter_label",80), name=val(fd,"name",160), sort_order=Number(val(fd,"sort_order",8));
  if(!isUuid(title_id)||!chapter_label||!Number.isInteger(sort_order)||sort_order<1||sort_order>99999999)fail();
  const titleSlug=await ensureType(db,title_id,readingTypes);
  const {error}=await db.from("title_chapters").insert({title_id,chapter_label,chapter_number:/^\d+(?:\.\d+)?$/.test(chapter_label)?Number(chapter_label):null,sort_order,name:name||null,status:fd.get("publish")==="yes"?"published":"draft"});
  if(error?.code==="23505")fail("chapter-duplicate");
  if(error){console.error("[admin] chapter:",error.message);fail("save");} revalidatePath("/title/"+titleSlug);success("chapter-created");
}

export async function updateChapter(fd: FormData) {
  const db=await admin(), id=val(fd,"chapter_id",36), chapter_label=val(fd,"chapter_label",80), sort_order=Number(val(fd,"sort_order",8));
  const name=val(fd,"name",160), description=val(fd,"description",3000), release_date=val(fd,"release_date",10), status=val(fd,"status",16);
  if(!isUuid(id)||!chapter_label||!Number.isInteger(sort_order)||sort_order<1||sort_order>99999999||(release_date&&!/^\d{4}-\d{2}-\d{2}$/.test(release_date))||!['draft','published','archived'].includes(status))fail("chapter-invalid");
  const numericLabel=/^\d+(?:\.\d+)?$/.test(chapter_label), chapter_number=numericLabel?Number(chapter_label):null;
  if(chapter_number!==null&&(chapter_number>999999.999||Math.round(chapter_number*1000)!==chapter_number*1000))fail("chapter-invalid");
  const {data:current,error:lookupError}=await db.from("title_chapters").select("title_id").eq("id",id).maybeSingle();
  if(lookupError||!current)fail("chapter-invalid");
  const titleSlug=await ensureType(db,current.title_id,readingTypes);
  const {error}=await db.from("title_chapters").update({chapter_label,chapter_number,sort_order,name:name||null,description:description||null,release_date:release_date||null,status,updated_at:new Date().toISOString()}).eq("id",id);
  if(error?.code==="23505")fail("chapter-duplicate");
  if(error){console.error("[admin] update chapter:",error.message);fail("save");}
  revalidatePath("/title/"+titleSlug);success("chapter-updated");
}

export async function createEdition(fd: FormData) {
  const db=await admin(), title_id=val(fd,"title_id",36), edition_kind=val(fd,"edition_kind",16);
  const edition_number=Number(val(fd,"edition_number",6)), name=val(fd,"name",160), language_code=val(fd,"language_code",35), description=val(fd,"description",3000);
  if(!isUuid(title_id)||!Number.isInteger(edition_number)||edition_number<1||edition_number>999999||!name||!['graphic','text'].includes(edition_kind))fail("edition-invalid");
  const titleSlug=await ensureType(db,title_id,readingTypes);
  const {error}=await db.from("title_editions").insert({title_id,edition_kind,edition_number,name,language_code:language_code||null,description:description||null,status:fd.get("publish")==="yes"?"published":"draft"});
  if(error?.code==="23505")fail("edition-duplicate");
  if(error){console.error("[admin] edition:",error.message);fail("save");}
  revalidatePath("/title/"+titleSlug);
  success("edition-created");
}

export async function createVolume(fd: FormData) {
  const db=await admin(), title_id=val(fd,"title_id",36), edition_id=val(fd,"edition_id",36), rawNumber=val(fd,"volume_number",10);
  const volume_number=Number(rawNumber), name=val(fd,"name",160), description=val(fd,"description",3000);
  if(!isUuid(title_id)||(edition_id&&!isUuid(edition_id))||!Number.isFinite(volume_number)||volume_number<=0||volume_number>99999.99||Math.round(volume_number*100)!==volume_number*100)fail("volume-invalid");
  const titleSlug=await ensureType(db,title_id,readingTypes);
  if(edition_id){const {data,error}=await db.from("title_editions").select("id").eq("id",edition_id).eq("title_id",title_id).maybeSingle();if(error||!data)fail("volume-invalid");}
  const {error}=await db.from("title_volumes").insert({title_id,edition_id:edition_id||null,volume_number,name:name||null,description:description||null,status:fd.get("publish")==="yes"?"published":"draft"});
  if(error?.code==="23505")fail("volume-duplicate");
  if(error){console.error("[admin] volume:",error.message);fail("save");}
  revalidatePath("/title/"+titleSlug);
  success("volume-created");
}

export async function updateEdition(fd: FormData) {
  const db=await admin(), id=val(fd,"edition_id",36), edition_kind=val(fd,"edition_kind",16);
  const edition_number=Number(val(fd,"edition_number",6)), name=val(fd,"name",160), language_code=val(fd,"language_code",35), description=val(fd,"description",3000), status=val(fd,"status",16);
  if(!isUuid(id)||!Number.isInteger(edition_number)||edition_number<1||edition_number>999999||!name||!['graphic','text'].includes(edition_kind)||!['draft','published','archived'].includes(status))fail("edition-invalid");
  const {data:current,error:lookupError}=await db.from("title_editions").select("title_id").eq("id",id).maybeSingle();
  if(lookupError||!current)fail("edition-invalid");
  const titleSlug=await ensureType(db,current.title_id,readingTypes);
  const {error}=await db.from("title_editions").update({edition_kind,edition_number,name,language_code:language_code||null,description:description||null,status,updated_at:new Date().toISOString()}).eq("id",id);
  if(error?.code==="23505")fail("edition-duplicate");
  if(error){console.error("[admin] update edition:",error.message);fail("save");}
  revalidatePath("/title/"+titleSlug);
  success("edition-updated");
}

export async function updateVolume(fd: FormData) {
  const db=await admin(), id=val(fd,"volume_id",36), rawNumber=val(fd,"volume_number",10), volume_number=Number(rawNumber);
  const name=val(fd,"name",160), description=val(fd,"description",3000), status=val(fd,"status",16);
  if(!isUuid(id)||!Number.isFinite(volume_number)||volume_number<=0||volume_number>99999.99||Math.round(volume_number*100)!==volume_number*100||!['draft','published','archived'].includes(status))fail("volume-invalid");
  const {data:current,error:lookupError}=await db.from("title_volumes").select("title_id").eq("id",id).maybeSingle();
  if(lookupError||!current)fail("volume-invalid");
  const titleSlug=await ensureType(db,current.title_id,readingTypes);
  const {error}=await db.from("title_volumes").update({volume_number,name:name||null,description:description||null,status,updated_at:new Date().toISOString()}).eq("id",id);
  if(error?.code==="23505")fail("volume-duplicate");
  if(error){console.error("[admin] update volume:",error.message);fail("save");}
  revalidatePath("/title/"+titleSlug);
  success("volume-updated");
}

export async function addVideoSource(fd: FormData) {
  const db=await admin(), title_id=val(fd,"title_id",36), episode_id=val(fd,"episode_id",36), source_url=val(fd,"source_url",2048);
  const source_format=val(fd,"source_format",20), provider_name=val(fd,"provider_name",120), language_code=val(fd,"language_code",35), quality_label=val(fd,"quality_label",80);
  if(!isUuid(title_id)||(episode_id&&!isUuid(episode_id))||!secureUrl(source_url)||!["hls","dash","mp4","embed"].includes(source_format))fail();
  if(source_format==="embed"&&!supportedVideoEmbedUrl(source_url))fail("unsupported-embed");
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

async function updateSource(fd: FormData, kind: "video" | "reading") {
  const db = await admin();
  const id = val(fd, "source_id", 36);
  const source_url = val(fd, "source_url", 2048);
  const source_format = val(fd, "source_format", 30);
  const provider_name = val(fd, "provider_name", 120);
  const language_code = val(fd, "language_code", 35);
  const quality_label = val(fd, "quality_label", 80);
  const availability_status = val(fd, "availability_status", 20);
  const publication_status = val(fd, "publication_status", 20);
  const validFormats = kind === "video" ? ["hls", "dash", "mp4", "embed"] : ["image_pages", "pdf", "epub", "html", "plain_text"];
  if (!isUuid(id) || !secureUrl(source_url) || !validFormats.includes(source_format)
    || !["available", "unavailable", "pending"].includes(availability_status)
    || !["draft", "published", "disabled"].includes(publication_status)) fail("source-invalid");
  if (publication_status === "published" && availability_status !== "available") fail("source-invalid");
  if (kind === "video" && source_format === "embed" && !supportedVideoEmbedUrl(source_url)) fail("unsupported-embed");
  if (publication_status === "published" && fd.get("rights_confirmed") !== "yes") fail("rights");

  const table = kind === "video" ? "video_sources" : "reading_sources";
  const { data: current, error: lookupError } = await db.from(table).select("title_id,rights_status,reviewed_at").eq("id", id).maybeSingle();
  if (lookupError || !current) fail("source-invalid");
  const { data: title, error: titleError } = await db.from("titles").select("slug,content_type").eq("id", current.title_id).maybeSingle();
  const allowedTypes = kind === "video" ? videoTypes : readingTypes;
  if (titleError || !title || !allowedTypes.includes(title.content_type)) fail("source-invalid");

  const sourceUpdate = {
    source_url,
    source_format,
    provider_name: provider_name || null,
    language_code: language_code || null,
    availability_status,
    publication_status,
    rights_status: publication_status === "published" ? "approved" : current.rights_status,
    reviewed_at: publication_status === "published" ? new Date().toISOString() : current.reviewed_at,
    updated_at: new Date().toISOString(),
  };
  const { error } = await (kind === "video"
    ? db.from("video_sources").update({ ...sourceUpdate, quality_label: quality_label || null }).eq("id", id)
    : db.from("reading_sources").update(sourceUpdate).eq("id", id));
  if (error) { console.error(`[admin] update ${kind} source:`, error.message); fail("save"); }
  revalidatePath("/title/" + title.slug);
  success(kind === "video" ? "video-source-updated" : "reading-source-updated");
}

export async function updateVideoSource(fd: FormData) { await updateSource(fd, "video"); }
export async function updateReadingSource(fd: FormData) { await updateSource(fd, "reading"); }
