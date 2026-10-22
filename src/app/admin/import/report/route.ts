import { createClient } from "@/lib/supabase/server";

const statuses = ["queued", "running", "completed", "partial", "failed"] as const;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function nextUtcDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString();
}

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[\s\u0000-\u001f]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const db = await createClient();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return Response.json({ error: "Требуется вход." }, { status: 401 });
  if (user.app_metadata?.role !== "catalog_admin") return Response.json({ error: "Недостаточно прав." }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const invalidFrom = from && (!datePattern.test(from) || Number.isNaN(Date.parse(`${from}T00:00:00Z`)));
  const invalidTo = to && (!datePattern.test(to) || Number.isNaN(Date.parse(`${to}T00:00:00Z`)));
  if (invalidFrom || invalidTo) return Response.json({ error: "Укажи даты в формате YYYY-MM-DD." }, { status: 400 });
  if (from && to && from > to) return Response.json({ error: "Дата начала позже даты окончания." }, { status: 400 });

  const rows: { id: string; source_name: string; status: string; input_count: number; created_count: number; updated_count: number; skipped_count: number; error_count: number; created_at: string; completed_at: string | null; actor_id: string | null }[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    let query = db.from("catalog_import_jobs").select("id,source_name,status,input_count,created_count,updated_count,skipped_count,error_count,created_at,completed_at,actor_id").order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
    if (from) query = query.gte("created_at", `${from}T00:00:00.000Z`);
    if (to) query = query.lt("created_at", nextUtcDate(to));
    const { data, error } = await query;
    if (error) return Response.json({ error: "Не удалось сформировать отчёт импорта." }, { status: 500 });
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    if (offset >= 99_000) return Response.json({ error: "Отчёт превышает лимит 100 000 заданий. Уточни период." }, { status: 413 });
  }

  const totals = rows.reduce((acc, row) => {
    acc.jobs += 1; acc.input += row.input_count; acc.created += row.created_count;
    acc.updated += row.updated_count; acc.skipped += row.skipped_count; acc.errors += row.error_count;
    acc.statuses[row.status] = (acc.statuses[row.status] ?? 0) + 1;
    return acc;
  }, { jobs: 0, input: 0, created: 0, updated: 0, skipped: 0, errors: 0, statuses: {} as Record<string, number> });
  const lines = [
    ["Сводка", "Заданий", "Строк", "Создано", "Дополнено", "Пропущено", "Ошибок", "В очереди", "Обрабатывается", "Завершено", "Частично", "С ошибкой"],
    ["Итого", totals.jobs, totals.input, totals.created, totals.updated, totals.skipped, totals.errors, ...statuses.map((status) => totals.statuses[status] ?? 0)],
    [],
    ["ID задания", "Источник", "Статус", "Строк", "Создано", "Дополнено", "Пропущено", "Ошибок", "Создано в", "Завершено в", "ID инициатора"],
    ...rows.map((row) => [row.id, row.source_name, row.status, row.input_count, row.created_count, row.updated_count, row.skipped_count, row.error_count, row.created_at, row.completed_at ?? "", row.actor_id ?? ""]),
  ];
  const csv = `\uFEFF${lines.map((line) => line.map(csvCell).join(",")).join("\r\n")}`;
  const dateLabel = new Date().toISOString().slice(0, 10);
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="subreel-import-report-${dateLabel}.csv"`, "Cache-Control": "private, no-store" } });
}
