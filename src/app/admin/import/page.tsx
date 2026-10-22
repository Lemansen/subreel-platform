import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { ImportForm } from "./import-form";
import { ImportJobErrors } from "./import-job-errors";
import { ImportJobRunner } from "./import-job-runner";
import { ImportReportLink } from "./report-link";

type SearchParams = Promise<{ q?: string; status?: string; page?: string }>;
const pageSize = 20;
const statusLabels: Record<string, string> = { queued: "В очереди", running: "Обрабатывается", completed: "Завершено", partial: "Частично", failed: "Ошибка" };

async function CatalogImportContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const db = await createClient();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) redirect("/login?next=%2Fadmin%2Fimport");
  if (user.app_metadata?.role !== "catalog_admin") notFound();

  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 120);
  const safeQuery = q.replace(/[^\p{L}\p{N}_ -]/gu, " ").replace(/\s+/g, " ").trim();
  const status = ["queued", "running", "completed", "partial", "failed"].includes(params.status ?? "") ? params.status! : "";
  const requestedPage = Math.min(10000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));

  async function loadJobs(page: number) {
    let query = db.from("catalog_import_jobs").select("id,actor_id,status,source_name,input_count,created_count,updated_count,skipped_count,error_count,next_row,created_at,completed_at", { count: "exact" });
    if (safeQuery) query = query.ilike("source_name", `%${safeQuery}%`);
    if (status) query = query.eq("status", status);
    return query.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  }

  let page = requestedPage;
  let result = await loadJobs(page);
  const total = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (!result.error && page > totalPages) { page = totalPages; result = await loadJobs(page); }
  const jobsError = result.error;
  const jobs = result.data ?? [];

  const actorIds = [...new Set(jobs.map((job) => job.actor_id).filter((id): id is string => Boolean(id)))];
  const { data: profiles } = actorIds.length ? await db.from("profiles").select("id,username,display_name").in("id", actorIds) : { data: [] };
  const actorNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name || profile.username || profile.id.slice(0, 8)]));

  function href(nextPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    next.set("page", String(nextPage));
    return `/admin/import?${next.toString()}`;
  }

  return <main className="min-h-screen bg-background text-white">
    <SiteHeader active="catalog"/>
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <Link href="/admin" className="text-sm text-violet-300 hover:text-violet-200">← Админ-панель</Link>
      <h1 className="mt-4 text-3xl font-black">Импорт каталога</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Загружай подготовленный JSON, проверяй совпадения и создавай черновики с записью результата в журнал.</p>
      {jobsError && <p role="alert" className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">Не удалось прочитать журнал заданий. Проверь миграции 024–026 в Supabase.</p>}
      <div className="mt-8"><ImportForm/></div>
      <div className="mt-8"><ImportReportLink/></div>

      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="text-xl font-bold">Журнал импорта</h2><p className="mt-1 text-xs text-zinc-500">Всего заданий по выбранным условиям: {total}</p></div>
          <form action="/admin/import" className="grid w-full gap-2 sm:w-auto sm:grid-cols-[minmax(220px,1fr)_180px_auto]">
            <input name="q" defaultValue={q} maxLength={120} placeholder="Название задания" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"/>
            <select name="status" defaultValue={status} className="rounded-xl border border-white/10 bg-[#111119] px-3 py-2 text-sm"><option value="">Все статусы</option><option value="queued">В очереди</option><option value="running">Обрабатывается</option><option value="completed">Завершено</option><option value="partial">Частично</option><option value="failed">Ошибка</option></select>
            <button className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold">Найти</button>
          </form>
        </div>
        {!jobsError && !jobs.length ? <p className="mt-6 rounded-xl bg-black/20 p-5 text-center text-sm text-zinc-500">Подходящих заданий нет.</p> : <div className="mt-4 space-y-3">{jobs.map((job) => <article key={job.id} className="rounded-xl border border-white/5 bg-black/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-semibold">{job.source_name}</h3><p className="mt-1 text-xs text-zinc-500">Инициатор: {actorNames.get(job.actor_id ?? "") ?? (job.actor_id ? job.actor_id.slice(0, 8) : "неизвестно")} · {new Date(job.created_at).toLocaleString("ru-RU")}</p></div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">{statusLabels[job.status] ?? job.status}</span>
          </div>
          <p className="mt-3 text-xs text-zinc-400">Обработано: {Math.max(0, Math.min(job.input_count, job.next_row - 1))} / {job.input_count} · создано: {job.created_count} · дополнено: {job.updated_count} · пропущено: {job.skipped_count} · ошибок: {job.error_count}{job.completed_at ? ` · завершено ${new Date(job.completed_at).toLocaleString("ru-RU")}` : ""}</p>
          {(job.status === "queued" || job.status === "running") && <ImportJobRunner key={job.id} jobId={job.id} initialStatus={job.status} initialProgress={Math.max(0, job.next_row - 1)} inputCount={job.input_count} initialCounts={{ created: job.created_count, updated: job.updated_count, skipped: job.skipped_count, errors: job.error_count }}/>}
          <ImportJobErrors jobId={job.id} errorCount={job.error_count}/>
        </article>)}</div>}
        {!jobsError && totalPages > 1 && <nav aria-label="Страницы журнала" className="mt-5 flex items-center justify-between"><Link aria-disabled={page <= 1} className={`rounded-lg border border-white/10 px-4 py-2 text-sm ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={href(Math.max(1, page - 1))}>← Назад</Link><span className="text-xs text-zinc-500">Страница {page} из {totalPages}</span><Link aria-disabled={page >= totalPages} className={`rounded-lg border border-white/10 px-4 py-2 text-sm ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`} href={href(Math.min(totalPages, page + 1))}>Дальше →</Link></nav>}
      </section>
    </div>
  </main>;
}

export default function CatalogImportPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="min-h-screen bg-background p-8 text-white">Загружаем импорт…</main>}><CatalogImportContent searchParams={searchParams}/></Suspense>;
}
