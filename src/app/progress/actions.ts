"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LibraryStatus = "planned" | "in_progress" | "completed" | "on_hold" | "dropped";
const statuses: LibraryStatus[] = ["planned", "in_progress", "completed", "on_hold", "dropped"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function signedIn() {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  return { db, user: error ? null : user };
}

function refreshLibrary() {
  revalidatePath("/account/library");
  revalidatePath("/");
}

export async function saveLibraryEntry(titleId: string, status: LibraryStatus, isFavorite: boolean) {
  if (!uuid.test(titleId) || !statuses.includes(status) || typeof isFavorite !== "boolean") return { ok: false, reason: "invalid" as const };
  const { db, user } = await signedIn();
  if (!user) return { ok: false, reason: "sign-in" as const };

  const { data: title, error: titleError } = await db.from("titles").select("id").eq("id", titleId).eq("status", "published").maybeSingle();
  if (titleError || !title) return { ok: false, reason: "title" as const };

  const { error } = await db.from("user_library").upsert({ user_id: user.id, title_id: titleId, status, is_favorite: isFavorite }, { onConflict: "user_id,title_id" });
  if (error) {
    console.error("[library] save failed:", error.message);
    return { ok: false, reason: "save" as const };
  }
  refreshLibrary();
  return { ok: true as const };
}

export async function removeLibraryEntry(titleId: string) {
  if (!uuid.test(titleId)) return { ok: false, reason: "invalid" as const };
  const { db, user } = await signedIn();
  if (!user) return { ok: false, reason: "sign-in" as const };
  const { error } = await db.from("user_library").delete().eq("user_id", user.id).eq("title_id", titleId);
  if (error) {
    console.error("[library] remove failed:", error.message);
    return { ok: false, reason: "save" as const };
  }
  refreshLibrary();
  return { ok: true as const };
}

export async function saveVideoProgress(titleId: string, episodeId: string | null, position: number, duration: number | null, completed: boolean) {
  if (!uuid.test(titleId) || (episodeId !== null && !uuid.test(episodeId)) || !Number.isFinite(position) || position < 0 || position > 172800 || (duration !== null && (!Number.isFinite(duration) || duration <= 0 || duration > 172800))) return { ok: false as const };
  const { db, user } = await signedIn();
  if (!user) return { ok: false as const };
  const { data: title, error: titleError } = await db.from("titles").select("id").eq("id", titleId).eq("status", "published").maybeSingle();
  if (titleError || !title) return { ok: false as const };
  if (episodeId) {
    const { data: episode, error: episodeError } = await db.from("title_episodes").select("id").eq("id", episodeId).eq("title_id", titleId).eq("status", "published").maybeSingle();
    if (episodeError || !episode) return { ok: false as const };
  }
  const { error } = await db.from("video_progress").upsert({
    user_id: user.id,
    title_id: titleId,
    episode_id: episodeId,
    position_seconds: Math.floor(position),
    duration_seconds: duration ? Math.floor(duration) : null,
    completed_at: completed ? new Date().toISOString() : null,
  }, { onConflict: "user_id,title_id,unit_id" });
  if (error) {
    console.error("[progress] video save failed:", error.message);
    return { ok: false as const };
  }
  revalidatePath("/");
  return { ok: true as const };
}

export async function saveReadingProgress(titleId: string, chapterId: string | null, completed: boolean) {
  if (!uuid.test(titleId) || (chapterId !== null && !uuid.test(chapterId)) || typeof completed !== "boolean") return { ok: false as const };
  const { db, user } = await signedIn();
  if (!user) return { ok: false as const };
  const { data: title, error: titleError } = await db.from("titles").select("id").eq("id", titleId).eq("status", "published").maybeSingle();
  if (titleError || !title) return { ok: false as const };
  if (chapterId) {
    const { data: chapter, error: chapterError } = await db.from("title_chapters").select("id").eq("id", chapterId).eq("title_id", titleId).eq("status", "published").maybeSingle();
    if (chapterError || !chapter) return { ok: false as const };
  }
  const { error } = await db.from("reading_progress").upsert({
    user_id: user.id,
    title_id: titleId,
    chapter_id: chapterId,
    current_page: 1,
    completed_at: completed ? new Date().toISOString() : null,
  }, { onConflict: "user_id,title_id,unit_id" });
  if (error) {
    console.error("[progress] reading save failed:", error.message);
    return { ok: false as const };
  }
  revalidatePath("/");
  return { ok: true as const };
}
