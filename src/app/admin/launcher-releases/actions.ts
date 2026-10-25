"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function text(fd: FormData, key: string, max: number) { const v=fd.get(key); return typeof v === "string" ? v.trim().slice(0,max) : ""; }
function error(code: string): never { redirect(`/admin/launcher-releases?error=${encodeURIComponent(code)}`); }
async function admin() {
  const db=await createClient();
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user) redirect("/login?next=%2Fadmin%2Flauncher-releases");
  if(user.app_metadata?.role!=="catalog_admin") redirect("/");
  return {db,user};
}
function validReleaseUrl(value: string) { try { const u=new URL(value); return u.protocol === "https:" && u.hostname === "github.com" && /^\/[^/]+\/[^/]+\/releases\/tag\/[^/]+$/.test(u.pathname); } catch { return false; } }
export async function createRelease(fd: FormData) {
  const {db,user}=await admin();
  const version=text(fd,"version",64),channel=text(fd,"channel",10),title=text(fd,"title",160),summary=text(fd,"summary",2000),url=text(fd,"github_release_url",2048);
  const change_notes=text(fd,"change_notes",5000).split(/\r?\n/).map(v=>v.trim()).filter(Boolean).slice(0,30);
  if(!version||!title||!summary||!validReleaseUrl(url)||!['stable','beta'].includes(channel)) error("invalid-release");
  const publish=fd.get("publish")==="on";
  const {error:saveError}=await db.from("launcher_releases").insert({version,channel,title,summary,change_notes,github_release_url:url,status:publish?"published":"draft",created_by:user.id,published_at:publish?new Date().toISOString():null});
  if(saveError){console.error("[admin] launcher release:",saveError.message);error(saveError.code==="23505"?"version-exists":"save-failed");}
  revalidatePath("/admin/launcher-releases"); revalidatePath("/news"); revalidatePath("/");
  redirect("/admin/launcher-releases?success=created");
}

export async function updateRelease(fd: FormData) {
  const {db}=await admin();
  const id=text(fd,"id",36),version=text(fd,"version",64),channel=text(fd,"channel",10),title=text(fd,"title",160),summary=text(fd,"summary",2000),url=text(fd,"github_release_url",2048);
  const change_notes=text(fd,"change_notes",5000).split(/\r?\n/).map(v=>v.trim()).filter(Boolean).slice(0,30);
  if(!/^[0-9a-f-]{36}$/i.test(id)||!version||!title||!summary||!validReleaseUrl(url)||!['stable','beta'].includes(channel)) error("invalid-release");
  const {error:saveError}=await db.from("launcher_releases").update({version,channel,title,summary,change_notes,github_release_url:url,updated_at:new Date().toISOString()}).eq("id",id);
  if(saveError){console.error("[admin] update launcher release:",saveError.message);error(saveError.code==="23505"?"version-exists":"save-failed");}
  revalidatePath("/admin/launcher-releases"); revalidatePath("/news"); revalidatePath("/");
  redirect("/admin/launcher-releases?success=updated");
}

export async function setReleaseStatus(fd: FormData) {
  const {db}=await admin(); const id=text(fd,"id",36),status=text(fd,"status",12);
  if(!/^[0-9a-f-]{36}$/i.test(id)||!['draft','published'].includes(status)) error("invalid-release");
  const {error:saveError}=await db.from("launcher_releases").update({status,published_at:status==="published"?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",id);
  if(saveError){console.error("[admin] launcher release status:",saveError.message);error("save-failed");}
  revalidatePath("/admin/launcher-releases"); revalidatePath("/news"); revalidatePath("/");
  redirect("/admin/launcher-releases?success=updated");
}
