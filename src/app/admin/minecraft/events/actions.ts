"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function value(fd: FormData, key: string, max: number) {
  const raw = fd.get(key);
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}
function fail(code: string): never {
  redirect(`/admin/minecraft/events?error=${encodeURIComponent(code)}`);
}
async function requireAdmin() {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect("/login?next=%2Fadmin%2Fminecraft%2Fevents");
  if (user.app_metadata?.role !== "catalog_admin") redirect("/");
  return { db, user };
}
const kinds = ["announcement","devlog","feature","maintenance","server_event","tournament","community","recruitment","roadmap","incident","guide","other"];
function slugify(input: string) {
  const slug = input.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 150);
  return slug.length >= 3 ? slug : `event-${Date.now()}`;
}
function optionalDate(input: string) {
  if (!input) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? "INVALID" : date.toISOString();
}
function payload(fd: FormData) {
  const kind = value(fd, "kind", 32);
  const title = value(fd, "title", 180);
  const summary = value(fd, "summary", 2400);
  const body = value(fd, "body", 30000);
  const cover = value(fd, "cover_image_url", 2048);
  const ctaLabel = value(fd, "cta_label", 60);
  const ctaUrl = value(fd, "cta_url", 2048);
  const tags = value(fd, "tags", 1000).split(",").map((tag) => tag.trim().slice(0, 32)).filter(Boolean).slice(0, 12);
  const startsAt = optionalDate(value(fd, "starts_at", 40));
  const endsAt = optionalDate(value(fd, "ends_at", 40));
  const scheduledAt = optionalDate(value(fd, "scheduled_at", 40));
  if (!kinds.includes(kind) || !title || !summary || [startsAt, endsAt, scheduledAt].includes("INVALID")) fail("invalid-publication");
  if (cover && !/^https:\/\//i.test(cover)) fail("invalid-cover-url");
  if ((ctaLabel && !ctaUrl) || (!ctaLabel && ctaUrl) || (ctaUrl && !/^https:\/\//i.test(ctaUrl))) fail("invalid-cta");
  if (startsAt && endsAt && new Date(endsAt) < new Date(startsAt)) fail("invalid-event-dates");
  return { kind, title, summary, body, cover_image_url: cover || null, tags, cta_label: ctaLabel || null, cta_url: ctaUrl || null, starts_at: startsAt, ends_at: endsAt, scheduled_at: scheduledAt };
}
export async function createPublication(fd: FormData) {
  const { db, user } = await requireAdmin();
  const data = payload(fd);
  const publish = fd.get("publish") === "on";
  const pinned = fd.get("pinned") === "on";
  const { error } = await db.from("minecraft_publications").insert({
    ...data,
    slug: slugify(value(fd, "slug", 180) || data.title),
    status: publish ? "published" : "draft",
    pinned,
    published_at: publish ? new Date().toISOString() : null,
    created_by: user.id,
  });
  if (error) { console.error("[admin] Minecraft publication create:", error.message); fail(error.code === "23505" ? "slug-exists" : "save-failed"); }
  revalidatePath("/admin/minecraft/events"); revalidatePath("/minecraft/events"); revalidatePath("/news");
  redirect("/admin/minecraft/events?success=created");
}
export async function updatePublication(fd: FormData) {
  const { db } = await requireAdmin();
  const id = value(fd, "id", 36);
  if (!/^[0-9a-f-]{36}$/i.test(id)) fail("invalid-id");
  const data = payload(fd);
  const slug = slugify(value(fd, "slug", 180) || data.title);
  const pinned = fd.get("pinned") === "on";
  const { error } = await db.from("minecraft_publications").update({
    ...data, slug, pinned, updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) { console.error("[admin] Minecraft publication update:", error.message); fail(error.code === "23505" ? "slug-exists" : "save-failed"); }
  revalidatePath("/admin/minecraft/events"); revalidatePath("/minecraft/events"); revalidatePath("/news");
  redirect("/admin/minecraft/events?success=updated");
}
export async function setPublicationStatus(fd: FormData) {
  const { db } = await requireAdmin();
  const id = value(fd, "id", 36);
  const status = value(fd, "status", 12);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["draft","published","archived"].includes(status)) fail("invalid-status");
  const { error } = await db.from("minecraft_publications").update({
    status,
    published_at: status === "published" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) { console.error("[admin] Minecraft publication status:", error.message); fail("save-failed"); }
  revalidatePath("/admin/minecraft/events"); revalidatePath("/minecraft/events"); revalidatePath("/news");
  redirect("/admin/minecraft/events?success=updated");
}
