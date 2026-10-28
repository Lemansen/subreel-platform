"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function text(fd: FormData, key: string, max: number) { const v=fd.get(key); return typeof v === "string" ? v.trim().slice(0,max) : ""; }
function coverUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && value.length <= 2048 ? url.toString() : false;
  } catch { return false; }
}
function error(code: string): never { redirect(`/admin/launcher-releases?error=${encodeURIComponent(code)}`); }
async function admin() {
  const db=await createClient();
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user) redirect("/login?next=%2Fadmin%2Flauncher-releases");
  if(user.app_metadata?.role!=="catalog_admin") redirect("/");
  return {db,user};
}
function parseReleaseUrl(value: string) {
  try {
    const url = new URL(value);
    const match = url.protocol === "https:" && url.hostname === "github.com"
      ? url.pathname.match(/^\/SBUnivers\/SubReel\.Launcher\/releases\/tag\/([^/]+)$/i)
      : null;
    return match ? { url: url.toString(), tag: decodeURIComponent(match[1]) } : null;
  } catch { return null; }
}

async function verifyGithubRelease(value: string, version: string, channel: string) {
  const parsed = parseReleaseUrl(value);
  if (!parsed) return "invalid-release-url";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.github.com/repos/SBUnivers/SubReel.Launcher/releases/tags/${encodeURIComponent(parsed.tag)}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "SubReel-Launcher-Admin" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status === 404) return "github-release-not-found";
    if (!response.ok) return "github-check-unavailable";
    const release: unknown = await response.json();
    if (!release || typeof release !== "object") return "github-check-unavailable";
    const data = release as { tag_name?: unknown; draft?: unknown; prerelease?: unknown; html_url?: unknown };
    if (data.tag_name !== parsed.tag || data.html_url !== parsed.url) return "github-release-mismatch";
    if (parsed.tag.replace(/^v/i, "") !== version.replace(/^v/i, "")) return "github-version-mismatch";
    if (data.draft === true) return "github-release-is-draft";
    if ((channel === "beta") !== (data.prerelease === true)) return "github-channel-mismatch";
    return null;
  } catch {
    return "github-check-unavailable";
  } finally { clearTimeout(timeout); }
}
export async function createRelease(fd: FormData) {
  const {db,user}=await admin();
  const version=text(fd,"version",64),channel=text(fd,"channel",10),title=text(fd,"title",160),summary=text(fd,"summary",2000),url=text(fd,"github_release_url",2048),newsTag=text(fd,"news_tag",20),cover=text(fd,"cover_url",2048);
  const parsedCover = coverUrl(cover);
  const change_notes=text(fd,"change_notes",5000).split(/\r?\n/).map(v=>v.trim()).filter(Boolean).slice(0,30);
  if(!version||!title||!summary||!parseReleaseUrl(url)||!['stable','beta'].includes(channel)||!['launcher','server','event'].includes(newsTag)||parsedCover===false) error("invalid-release");
  const publish=fd.get("publish")==="on";
  if (publish) {
    const validation = await verifyGithubRelease(url, version, channel);
    if (validation) error(validation);
  }
  const {error:saveError}=await db.from("launcher_releases").insert({version,channel,news_tag:newsTag,cover_url:parsedCover,title,summary,change_notes,github_release_url:url,status:publish?"published":"draft",created_by:user.id,published_at:publish?new Date().toISOString():null});
  if(saveError){console.error("[admin] launcher release:",saveError.message);error(saveError.code==="23505"?"version-exists":"save-failed");}
  revalidatePath("/admin/launcher-releases"); revalidatePath("/news"); revalidatePath("/");
  redirect("/admin/launcher-releases?success=created");
}

export async function updateRelease(fd: FormData) {
  const {db}=await admin();
  const id=text(fd,"id",36),version=text(fd,"version",64),channel=text(fd,"channel",10),title=text(fd,"title",160),summary=text(fd,"summary",2000),url=text(fd,"github_release_url",2048),newsTag=text(fd,"news_tag",20),cover=text(fd,"cover_url",2048);
  const parsedCover = coverUrl(cover);
  const change_notes=text(fd,"change_notes",5000).split(/\r?\n/).map(v=>v.trim()).filter(Boolean).slice(0,30);
  if(!/^[0-9a-f-]{36}$/i.test(id)||!version||!title||!summary||!parseReleaseUrl(url)||!['stable','beta'].includes(channel)||!['launcher','server','event'].includes(newsTag)||parsedCover===false) error("invalid-release");
  const {data:existing,error:readError}=await db.from("launcher_releases").select("status").eq("id",id).maybeSingle();
  if(readError||!existing) error("save-failed");
  if(existing.status==="published"){
    const validation=await verifyGithubRelease(url,version,channel);
    if(validation) error(validation);
  }
  const {error:saveError}=await db.from("launcher_releases").update({version,channel,news_tag:newsTag,cover_url:parsedCover,title,summary,change_notes,github_release_url:url,updated_at:new Date().toISOString()}).eq("id",id);
  if(saveError){console.error("[admin] update launcher release:",saveError.message);error(saveError.code==="23505"?"version-exists":"save-failed");}
  revalidatePath("/admin/launcher-releases"); revalidatePath("/news"); revalidatePath("/");
  redirect("/admin/launcher-releases?success=updated");
}

export async function setReleaseStatus(fd: FormData) {
  const {db}=await admin(); const id=text(fd,"id",36),status=text(fd,"status",12);
  if(!/^[0-9a-f-]{36}$/i.test(id)||!['draft','published'].includes(status)) error("invalid-release");
  if (status === "published") {
    const { data: release, error: readError } = await db.from("launcher_releases").select("github_release_url,version,channel").eq("id",id).maybeSingle();
    if (readError || !release) error("save-failed");
    const validation = await verifyGithubRelease(release.github_release_url, release.version, release.channel);
    if (validation) error(validation);
  }
  const {error:saveError}=await db.from("launcher_releases").update({status,published_at:status==="published"?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",id);
  if(saveError){console.error("[admin] launcher release status:",saveError.message);error("save-failed");}
  revalidatePath("/admin/launcher-releases"); revalidatePath("/news"); revalidatePath("/");
  redirect("/admin/launcher-releases?success=updated");
}
