"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveReadingProgress } from "@/app/progress/actions";

type Chapter = { id: string; chapter_label: string; name: string | null; sort_order: number };
type ReadingSource = { id: string; chapter_id: string | null; source_url: string; source_format: "image_pages" | "pdf" | "epub" | "html" | "plain_text"; provider_name: string | null; language_code: string | null };
type ReadingProgress = { chapter_id: string | null; current_page: number; total_pages: number | null; completed_at: string | null; updated_at: string };
type Width = "narrow" | "normal" | "wide";
const widthClass: Record<Width, string> = { narrow: "max-w-2xl", normal: "max-w-3xl", wide: "max-w-5xl" };

export function ReadingViewer({ titleId, chapters, sources, initialProgress, canSaveProgress }: { titleId: string; chapters: Chapter[]; sources: ReadingSource[]; initialProgress: ReadingProgress[]; canSaveProgress: boolean }) {
  const ordered = useMemo(() => [...chapters].sort((a, b) => a.sort_order - b.sort_order), [chapters]);
  const [read, setRead] = useState(() => new Set(initialProgress.filter((p) => p.completed_at).map((p) => p.chapter_id ?? "title")));
  const [chapterId, setChapterId] = useState(() => {
    const last = initialProgress[0]?.chapter_id;
    return (last && ordered.some((c) => c.id === last) ? last : null)
      ?? ordered.find((c) => sources.some((s) => s.chapter_id === c.id))?.id ?? "title";
  });
  const [sourceId, setSourceId] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [width, setWidth] = useState<Width>("normal");
  const [scroll, setScroll] = useState(0);
  const [, startTransition] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const index = ordered.findIndex((c) => c.id === chapterId);
  const chapter = ordered[index];
  const options = useMemo(() => {
    const specific = chapterId === "title" ? [] : sources.filter((s) => s.chapter_id === chapterId);
    return specific.length ? specific : sources.filter((s) => s.chapter_id === null);
  }, [chapterId, sources]);
  const selected = options.find((s) => s.id === sourceId) ?? options[0];

  useEffect(() => {
    const saved = localStorage.getItem("reader-width") as Width | null;
    if (saved && saved in widthClass) setWidth(saved);
  }, []);

  function open(id: string) {
    setChapterId(id); setSourceId(""); setListOpen(false);
    topRef.current?.scrollIntoView({ behavior: "smooth" });
    if (canSaveProgress) startTransition(async () => { await saveReadingProgress(titleId, id === "title" ? null : id, read.has(id)); });
  }
  const go = (d: number) => { const n = ordered[index + d]; if (n) open(n.id); };

  // Клавиши ← →
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Полоса прогресса прокрутки
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      setScroll(Math.min(1, el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Автоотметка «прочитано», когда долистал до конца главы
  useEffect(() => {
    const end = endRef.current;
    if (!end || !canSaveProgress || read.has(chapterId)) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      startTransition(async () => {
        const r = await saveReadingProgress(titleId, chapterId === "title" ? null : chapterId, true);
        if (r.ok) setRead((s) => new Set(s).add(chapterId));
      });
    }, { rootMargin: "0px 0px 200px 0px" });
    io.observe(end);
    return () => io.disconnect();
  }, [chapterId, canSaveProgress, read, titleId]);

  const label = chapter ? `Глава ${chapter.chapter_label}${chapter.name ? ` — ${chapter.name}` : ""}` : "Всё произведение";

  return (
    <section ref={topRef} className="relative mt-6">
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent">
        <div className="h-full bg-accent transition-[width]" style={{ width: `${scroll * 100}%` }} />
      </div>

      {/* Липкая панель читалки */}
      <div className="sticky top-16 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-white/5 bg-surface-1/90 p-2 backdrop-blur-xl">
        <button type="button" onClick={() => go(-1)} disabled={index <= 0} className="h-10 rounded-lg px-3 text-sm hover:bg-surface-2 disabled:opacity-30" aria-label="Предыдущая глава">◀</button>
        <button type="button" onClick={() => setListOpen((v) => !v)} className="h-10 min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-3 text-left text-sm font-medium">
          {label} <span className="text-text-muted">▾</span>
        </button>
        <button type="button" onClick={() => go(1)} disabled={index < 0 || index >= ordered.length - 1} className="h-10 rounded-lg px-3 text-sm hover:bg-surface-2 disabled:opacity-30" aria-label="Следующая глава">▶</button>
        <div className="flex rounded-lg bg-surface-2 p-0.5 text-xs">
          {(["narrow", "normal", "wide"] as Width[]).map((w) => (
            <button key={w} type="button" onClick={() => { setWidth(w); localStorage.setItem("reader-width", w); }}
              className={`rounded-md px-2 py-1.5 ${width === w ? "bg-accent-strong text-white" : "text-text-secondary"}`}>
              {w === "narrow" ? "S" : w === "normal" ? "M" : "L"}
            </button>
          ))}
        </div>
        {options.length > 1 && (
          <select value={selected?.id} onChange={(e) => setSourceId(e.target.value)} className="h-10 rounded-lg bg-surface-2 px-2 text-xs">
            {options.map((s) => <option key={s.id} value={s.id}>{[s.provider_name, s.language_code].filter(Boolean).join(" · ") || s.source_format}</option>)}
          </select>
        )}

        {listOpen && (
          <ul className="absolute inset-x-0 top-full mt-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-white/5 bg-surface-1 p-2 shadow-2xl">
            {[...ordered].reverse().map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => open(c.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${c.id === chapterId ? "bg-accent/15 text-accent" : "hover:bg-surface-2"}`}>
                  <span className="truncate">Глава {c.chapter_label}{c.name ? ` · ${c.name}` : ""}</span>
                  {read.has(c.id) && <span className="text-xs text-text-muted">✓ прочитано</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`mx-auto mt-4 ${widthClass[width]}`}>
        {selected ? <ReaderContent key={selected.id} source={selected} label={label} />
          : <div className="grid min-h-[50vh] place-items-center text-sm text-text-secondary">Для этой главы нет источника.</div>}
      </div>

      <div ref={endRef} className={`mx-auto mt-8 flex items-center justify-between gap-3 ${widthClass[width]}`}>
        <button type="button" onClick={() => go(-1)} disabled={index <= 0} className="h-12 flex-1 rounded-xl bg-surface-2 text-sm font-semibold disabled:opacity-30">◀ Предыдущая</button>
        <button type="button" onClick={() => go(1)} disabled={index < 0 || index >= ordered.length - 1} className="h-12 flex-1 rounded-xl bg-accent-strong text-sm font-semibold text-white disabled:opacity-30">Следующая глава ▶</button>
      </div>
    </section>
  );
}

function ReaderContent({ source, label }: { source: ReadingSource; label: string }) {
  const [pages, setPages] = useState<string[] | null>(null);
  const isManifest = source.source_format === "image_pages" && /\.json(\?|$)/i.test(source.source_url);

  useEffect(() => {
    if (!isManifest) return;
    let off = false;
    fetch(source.source_url).then((r) => r.json()).then((data: unknown) => {
      if (off) return;
      const list = Array.isArray(data) ? data.filter((u): u is string => typeof u === "string" && u.startsWith("https://")) : [];
      setPages(list);
    }).catch(() => !off && setPages([]));
    return () => { off = true; };
  }, [isManifest, source.source_url]);

  if (source.source_format === "pdf" || source.source_format === "epub") {
    return <div className="grid min-h-[40vh] place-items-center rounded-2xl bg-surface-1 p-8 text-center">
      <a href={source.source_url} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-accent-strong px-5 py-3 text-sm font-semibold text-white">Открыть {source.source_format.toUpperCase()} ↗</a>
    </div>;
  }

  if (isManifest) {
    if (pages === null) return <div className="space-y-2">{Array.from({ length: 3 }, (_, i) => <div key={i} className="aspect-[2/3] animate-pulse rounded bg-surface-2" />)}</div>;
    if (pages.length === 0) return <p className="py-20 text-center text-sm text-text-secondary">Не удалось загрузить страницы.</p>;
    return <div className="flex flex-col">
      {pages.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt={`${label}, страница ${i + 1}`} loading={i < 2 ? "eager" : "lazy"} referrerPolicy="no-referrer" className="block w-full select-none bg-surface-2" />
      ))}
    </div>;
  }

  return <iframe title={label} src={source.source_url} sandbox="allow-scripts" referrerPolicy="no-referrer"
    className="h-[80vh] w-full rounded-2xl border-0 bg-white" />;
}
