"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const contentTypes = ["anime", "movie", "series", "drama", "cartoon", "manga", "manhwa", "manhua", "light_novel", "web_novel", "book"] as const;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireCatalogAdmin() {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect("/login?next=%2Fadmin%2Ftitles");
  if (user.app_metadata?.role !== "catalog_admin") notFound();
  return db;
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validHttps(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export type TitleWizardInput = {
  id: string | null;
  name: string;
  original_name: string;
  slug: string;
  content_type: string;
  franchise_id: string;
  release_year: string;
  description: string;
  cover_url: string;
  banner_url: string;
  genre_ids: string[];
  save_as_draft: boolean;
};

export async function saveTitleWizard(input: TitleWizardInput) {
  const db = await requireCatalogAdmin();
  const name = cleanText(input?.name, 160);
  const original_name = cleanText(input?.original_name, 200);
  const slug = cleanText(input?.slug, 160).toLowerCase();
  const content_type = cleanText(input?.content_type, 32);
  const franchise_id = cleanText(input?.franchise_id, 36);
  const rawYear = cleanText(input?.release_year, 4);
  const release_year = rawYear ? Number(rawYear) : null;
  const description = cleanText(input?.description, 5000);
  const cover_url = cleanText(input?.cover_url, 2048);
  const banner_url = cleanText(input?.banner_url, 2048);
  const genre_ids = Array.isArray(input?.genre_ids) ? [...new Set(input.genre_ids.filter((id) => typeof id === "string" && uuidPattern.test(id)))].slice(0, 100) : [];

  if (!name || !slugPattern.test(slug) || !contentTypes.includes(content_type as typeof contentTypes[number])) return { ok: false as const, error: "Заполни название, корректный slug и тип произведения." };
  if (rawYear && (!Number.isInteger(release_year) || release_year! < 1800 || release_year! > 2200)) return { ok: false as const, error: "Год должен быть в диапазоне 1800–2200." };
  if (franchise_id && !uuidPattern.test(franchise_id)) return { ok: false as const, error: "Выбери существующую франшизу." };
  if (!validHttps(cover_url) || !validHttps(banner_url)) return { ok: false as const, error: "Изображения должны иметь HTTPS-ссылки без логина и пароля." };
  if (input.id && !uuidPattern.test(input.id)) return { ok: false as const, error: "Некорректный идентификатор тайтла." };

  if (franchise_id) {
    const { data, error } = await db.from("franchises").select("id").eq("id", franchise_id).maybeSingle();
    if (error || !data) return { ok: false as const, error: "Выбранная франшиза больше недоступна." };
  }
  if (genre_ids.length) {
    const { data, error } = await db.from("genres").select("id").in("id", genre_ids);
    if (error || data?.length !== genre_ids.length) return { ok: false as const, error: "Один из выбранных жанров больше недоступен. Обнови страницу." };
  }

  const titleData = {
    name,
    original_name: original_name || null,
    slug,
    content_type,
    franchise_id: franchise_id || null,
    release_year,
    description: description || null,
    cover_url: cover_url || null,
    banner_url: banner_url || null,
    updated_at: new Date().toISOString(),
  };
  let titleId = input.id;
  let oldSlug: string | null = null;

  if (titleId) {
    const { data: current, error: lookupError } = await db.from("titles").select("id,slug,status").eq("id", titleId).maybeSingle();
    if (lookupError || !current) return { ok: false as const, error: "Тайтл не найден или больше недоступен." };
    oldSlug = current.slug;
    const { error } = await db.from("titles").update({ ...titleData, status: input.save_as_draft ? "draft" : current.status }).eq("id", titleId);
    if (error?.code === "23505") return { ok: false as const, error: "Этот slug уже занят другим тайтлом." };
    if (error) {
      console.error("[admin titles] update:", error.message);
      return { ok: false as const, error: "Не удалось сохранить изменения тайтла." };
    }
  } else {
    const { data: created, error } = await db.from("titles").insert({ ...titleData, status: "draft" }).select("id").single();
    if (error?.code === "23505") return { ok: false as const, error: "Этот slug уже занят. Измени slug и попробуй ещё раз." };
    if (error || !created) {
      console.error("[admin titles] create:", error?.message ?? "missing row");
      return { ok: false as const, error: "Не удалось создать черновик." };
    }
    titleId = created.id;
  }

  const { data: currentGenres, error: currentGenresError } = await db.from("title_genres").select("genre_id").eq("title_id", titleId);
  if (currentGenresError) return { ok: false as const, id: titleId, error: "Основные данные сохранены, но жанры не обновились." };
  const currentIds = new Set((currentGenres ?? []).map((row) => row.genre_id));
  const additions = genre_ids.filter((id) => !currentIds.has(id));
  const removals = [...currentIds].filter((id) => !genre_ids.includes(id));
  if (additions.length) {
    const { error } = await db.from("title_genres").insert(additions.map((genre_id) => ({ title_id: titleId, genre_id })));
    if (error) return { ok: false as const, id: titleId, error: "Основные данные сохранены, но жанры не обновились." };
  }
  if (removals.length) {
    const { error } = await db.from("title_genres").delete().eq("title_id", titleId).in("genre_id", removals);
    if (error) return { ok: false as const, id: titleId, error: "Основные данные сохранены, но жанры не обновились." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/titles");
  revalidatePath("/catalog");
  revalidatePath("/");
  if (oldSlug) revalidatePath(`/title/${oldSlug}`);
  revalidatePath(`/title/${slug}`);
  return { ok: true as const, id: titleId, slug };
}

export async function setTitleStatus(titleId: string, status: "draft" | "published" | "archived") {
  const db = await requireCatalogAdmin();
  if (!uuidPattern.test(titleId)) return { ok: false as const, error: "Некорректный идентификатор тайтла." };
  const { data: title, error: lookupError } = await db.from("titles").select("slug,name").eq("id", titleId).maybeSingle();
  if (lookupError || !title) return { ok: false as const, error: "Тайтл не найден." };
  const { error } = await db.from("titles").update({ status, updated_at: new Date().toISOString() }).eq("id", titleId);
  if (error) return { ok: false as const, error: "Статус не изменён. Проверь данные тайтла и права Supabase." };
  revalidatePath("/admin"); revalidatePath("/admin/titles"); revalidatePath("/catalog"); revalidatePath("/"); revalidatePath(`/title/${title.slug}`);
  return { ok: true as const, message: status === "published" ? "Тайтл опубликован." : status === "archived" ? "Тайтл перемещён в архив." : "Тайтл снят с публикации." };
}

export async function duplicateTitle(titleId: string) {
  const db = await requireCatalogAdmin();
  if (!uuidPattern.test(titleId)) return { ok: false as const, error: "Некорректный идентификатор тайтла." };
  const { data: source, error } = await db.from("titles").select("name,original_name,slug,description,cover_url,banner_url,content_type,release_year,franchise_id").eq("id", titleId).maybeSingle();
  if (error || !source) return { ok: false as const, error: "Исходный тайтл не найден." };
  const [genresRes,seasonsRes,episodesRes,editionsRes,volumesRes,chaptersRes] = await Promise.all([
    db.from("title_genres").select("genre_id").eq("title_id", titleId),
    db.from("title_seasons").select("id,season_number,name,description,status").eq("title_id", titleId).order("season_number"),
    db.from("title_episodes").select("season_id,episode_number,sort_order,name,description,duration_seconds,release_date,status").eq("title_id", titleId).order("sort_order"),
    db.from("title_editions").select("id,edition_kind,edition_number,name,language_code,description,status").eq("title_id", titleId).order("edition_number"),
    db.from("title_volumes").select("id,edition_id,volume_number,name,description,status").eq("title_id", titleId).order("volume_number"),
    db.from("title_chapters").select("edition_id,volume_id,chapter_number,chapter_label,sort_order,name,description,release_date,status").eq("title_id", titleId).order("sort_order"),
  ]);
  if ([genresRes,seasonsRes,episodesRes,editionsRes,volumesRes,chaptersRes].some((result)=>result.error)) return {ok:false as const,error:"Не удалось прочитать исходную структуру. Копия не создана."};
  const baseSlug = `${source.slug}-copy`.slice(0, 155).replace(/-+$/, "");
  let createdId: string | null = null;
  let createdSlug = "";
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    createdSlug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`;
    const { data, error: insertError } = await db.from("titles").insert({
      ...source,
      name: `${source.name} — копия`.slice(0, 160),
      slug: createdSlug,
      status: "draft",
      updated_at: new Date().toISOString(),
    }).select("id").single();
    if (!insertError && data) { createdId = data.id; break; }
    if (insertError?.code !== "23505") {
      console.error("[admin titles] duplicate:", insertError?.message ?? "missing row");
      return { ok: false as const, error: "Не удалось создать копию." };
    }
  }
  if (!createdId) return { ok: false as const, error: "Не удалось подобрать свободный slug для копии." };

  try {
    const copyId=createdId;
    const genres=genresRes.data??[],seasons=seasonsRes.data??[],episodes=episodesRes.data??[],editions=editionsRes.data??[],volumes=volumesRes.data??[],chapters=chaptersRes.data??[];
    if(genres.length){const {error:copyError}=await db.from("title_genres").insert(genres.map(({genre_id})=>({title_id:copyId,genre_id})));if(copyError)throw copyError;}
    const seasonIds=new Map<string,string>();
    for(const season of seasons){const {id:sourceSeasonId,...seasonData}=season;const {data,error:copyError}=await db.from("title_seasons").insert({title_id:copyId,...seasonData}).select("id").single();if(copyError||!data)throw copyError??new Error("season copy failed");seasonIds.set(sourceSeasonId,data.id);}
    if(episodes.length){const rows=episodes.map(({season_id,...episode})=>({title_id:copyId,...episode,season_id:season_id?seasonIds.get(season_id)??null:null}));const {error:copyError}=await db.from("title_episodes").insert(rows);if(copyError)throw copyError;}
    const editionIds=new Map<string,string>();
    for(const edition of editions){const {id:sourceEditionId,...editionData}=edition;const {data,error:copyError}=await db.from("title_editions").insert({title_id:copyId,...editionData}).select("id").single();if(copyError||!data)throw copyError??new Error("edition copy failed");editionIds.set(sourceEditionId,data.id);}
    const volumeIds=new Map<string,string>();
    for(const volume of volumes){const {id:sourceVolumeId,...volumeData}=volume;const {data,error:copyError}=await db.from("title_volumes").insert({title_id:copyId,...volumeData,edition_id:volume.edition_id?editionIds.get(volume.edition_id)??null:null}).select("id").single();if(copyError||!data)throw copyError??new Error("volume copy failed");volumeIds.set(sourceVolumeId,data.id);}
    if(chapters.length){
      const rows=chapters.map(({edition_id,volume_id,...chapter})=>({...chapter,title_id:copyId,edition_id:edition_id?editionIds.get(edition_id)??null:null,volume_id:volume_id?volumeIds.get(volume_id)??null:null}));
      const {error:copyError}=await db.from("title_chapters").insert(rows);if(copyError)throw copyError;
    }
  } catch (copyError) {
    console.error("[admin titles] duplicate structure:",copyError instanceof Error?copyError.message:"copy failed");
    const {error:cleanupError}=await db.from("titles").delete().eq("id",createdId);
    if(cleanupError)console.error("[admin titles] duplicate cleanup:",cleanupError.message);
    return {ok:false as const,error:cleanupError?"Копирование структуры не завершилось; черновик создан и требует проверки в списке тайтлов.":"Не удалось скопировать структуру. Неполная копия удалена."};
  }
  revalidatePath("/admin/titles");
  revalidatePath("/admin");
  return { ok: true as const, id: createdId, slug: createdSlug };
}

export async function deleteTitle(titleId: string) {
  const db = await requireCatalogAdmin();
  if (!uuidPattern.test(titleId)) return { ok: false as const, error: "Некорректный идентификатор тайтла." };
  const { data: title, error: lookupError } = await db.from("titles").select("slug,name").eq("id", titleId).maybeSingle();
  if (lookupError || !title) return { ok: false as const, error: "Тайтл не найден." };

  // The authenticated admin cannot see other users' library rows through owner-only RLS,
  // so dependency checks use the server-only service client after the role check above.
  const service = createSupabaseAdminClient();
  if (!service) return { ok: false as const, error: "Удаление отключено: не настроен серверный Supabase admin key." };
  const [genres, relationships, seasons, episodes, editions, volumes, chapters, video, reading, reviews, library, videoProgress, readingProgress] = await Promise.all([
    service.from("title_genres").select("title_id", { count: "exact", head: true }).eq("title_id", titleId),
    service.from("title_relationships").select("id", { count: "exact", head: true }).or(`source_title_id.eq.${titleId},target_title_id.eq.${titleId}`),
    service.from("title_seasons").select("id", { count: "exact", head: true }).eq("title_id", titleId),
    service.from("title_episodes").select("id", { count: "exact", head: true }).eq("title_id", titleId),
    service.from("title_editions").select("id", { count: "exact", head: true }).eq("title_id", titleId),
    service.from("title_volumes").select("id", { count: "exact", head: true }).eq("title_id", titleId),
    service.from("title_chapters").select("id", { count: "exact", head: true }).eq("title_id", titleId),
    service.from("video_sources").select("id", { count: "exact", head: true }).eq("title_id", titleId),
    service.from("reading_sources").select("id", { count: "exact", head: true }).eq("title_id", titleId),
    service.from("title_reviews").select("id", { count: "exact", head: true }).eq("title_id", titleId),
    service.from("user_library").select("title_id", { count: "exact", head: true }).eq("title_id", titleId),
    service.from("video_progress").select("title_id", { count: "exact", head: true }).eq("title_id", titleId),
    service.from("reading_progress").select("title_id", { count: "exact", head: true }).eq("title_id", titleId),
  ]);
  const checks = [genres, relationships, seasons, episodes, editions, volumes, chapters, video, reading, reviews, library, videoProgress, readingProgress];
  if (checks.some((result) => result.error)) return { ok: false as const, error: "Не удалось проверить связанные данные. Удаление отменено; попробуй архивировать тайтл." };
  const dependencyNames = ["жанры", "связи", "сезоны", "серии", "издания", "тома", "главы", "видеоисточники", "источники чтения", "отзывы", "записи библиотеки", "прогресс просмотра", "прогресс чтения"];
  const dependencies = checks.flatMap((result, index) => result.count ? [`${dependencyNames[index]}: ${result.count}`] : []);
  if (dependencies.length) return { ok: false as const, error: `Удаление остановлено: связаны ${dependencies.join(", ")}. Перемести тайтл в архив, чтобы сохранить эти данные.` };
  const { error } = await db.from("titles").delete().eq("id", titleId);
  if (error) return { ok: false as const, error: "Удалить тайтл не удалось. Его данные сохранены." };
  revalidatePath("/admin"); revalidatePath("/admin/titles"); revalidatePath("/catalog"); revalidatePath("/"); revalidatePath(`/title/${title.slug}`);
  return { ok: true as const };
}

export async function getTitleWizardData(titleId?: string) {
  const db = await requireCatalogAdmin();
  const [genresRes, franchisesRes, titleRes] = await Promise.all([
    db.from("genres").select("id,name").order("name").limit(500),
    db.from("franchises").select("id,name,status").order("name").limit(500),
    titleId ? db.from("titles").select("id,name,original_name,slug,content_type,franchise_id,release_year,description,cover_url,banner_url,status").eq("id", titleId).maybeSingle() : Promise.resolve({data:null,error:null}),
  ]);
  if (genresRes.error || franchisesRes.error || titleRes.error || (titleId && !titleRes.data)) return {ok:false as const,error:"Не удалось загрузить данные мастера. Обнови страницу."};
  const genreRes = titleId ? await db.from("title_genres").select("genre_id").eq("title_id", titleId) : {data:[],error:null};
  if (genreRes.error) return {ok:false as const,error:"Не удалось загрузить жанры тайтла."};
  return {ok:true as const, genres:genresRes.data??[], franchises:franchisesRes.data??[], title:titleRes.data, genreIds:(genreRes.data??[]).map((x)=>x.genre_id)};
}
