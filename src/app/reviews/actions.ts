"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function saveTitleReview(titleId: string, rating: number, body: string, isPublic: boolean) {
  if (!UUID.test(titleId) || !Number.isInteger(rating) || rating < 1 || rating > 10 || typeof body !== "string" || [...body].length > 3000 || typeof isPublic !== "boolean") {
    return { ok: false as const, reason: "invalid" as const };
  }

  const db = await createClient();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return { ok: false as const, reason: "sign-in" as const };

  const { data: title, error: titleError } = await db.from("titles").select("slug").eq("id", titleId).eq("status", "published").maybeSingle();
  if (titleError || !title) return { ok: false as const, reason: "title" as const };

  const { error } = await db.from("title_reviews").upsert({
    user_id: user.id,
    title_id: titleId,
    rating,
    body: body.trim(),
    is_public: isPublic,
  }, { onConflict: "user_id,title_id" });
  if (error) {
    console.error("[reviews] save failed:", error.message);
    return { ok: false as const, reason: "save" as const };
  }

  revalidatePath(`/title/${title.slug}`);
  return { ok: true as const };
}

export async function removeTitleReview(titleId: string) {
  if (!UUID.test(titleId)) return { ok: false as const, reason: "invalid" as const };
  const db = await createClient();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return { ok: false as const, reason: "sign-in" as const };

  const { data: title, error: titleError } = await db.from("titles").select("slug").eq("id", titleId).eq("status", "published").maybeSingle();
  if (titleError || !title) return { ok: false as const, reason: "title" as const };

  const { error } = await db.from("title_reviews").delete().eq("user_id", user.id).eq("title_id", titleId);
  if (error) {
    console.error("[reviews] delete failed:", error.message);
    return { ok: false as const, reason: "save" as const };
  }
  revalidatePath(`/title/${title.slug}`);
  return { ok: true as const };
}
