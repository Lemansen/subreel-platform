"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { saveVideoProgress } from "@/app/progress/actions";

type Episode = { id: string; episode_number: number; name: string | null; season_id: string | null };
type VideoSource = { id: string; episode_id: string | null; source_url: string; source_format: "hls" | "dash" | "mp4" | "embed"; provider_name: string | null; language_code: string | null; quality_label: string | null };
type VideoProgress = { episode_id: string | null; position_seconds: number; duration_seconds: number | null; completed_at: string | null; updated_at: string };

export function VideoPlayback({ titleId, episodes, sources, initialProgress, canSaveProgress, initialEpisodeId }: { titleId: string; episodes: Episode[]; sources: VideoSource[]; initialProgress: VideoProgress[]; canSaveProgress: boolean; initialEpisodeId?: string | null }) {
  const playable = useMemo(() => sources.filter((s) => ["mp4", "hls", "dash", "embed"].includes(s.source_format)), [sources]);
  const watched = useMemo(() => new Set(initialProgress.filter((p) => p.completed_at).map((p) => p.episode_id ?? "title")), [initialProgress]);
  const latest = initialProgress[0];
  const initial =
    (initialEpisodeId && episodes.some((e) => e.id === initialEpisodeId) ? initialEpisodeId : null) ??
    (latest?.episode_id && episodes.some((e) => e.id === latest.episode_id) ? latest.episode_id : null) ??
    episodes.find((e) => playable.some((s) => s.episode_id === e.id))?.id ?? "title";

  const [episodeId, setEpisodeId] = useState(initial);
  const [sourceId, setSourceId] = useState("");
  const [autoNext, setAutoNext] = useState(true);

  const options = useMemo(() => {
    const specific = episodeId === "title" ? [] : playable.filter((s) => s.episode_id === episodeId);
    return specific.length ? specific : playable.filter((s) => s.episode_id === null);
  }, [episodeId, playable]);
  const selected = options.find((s) => s.id === sourceId) ?? options[0];
  const activeEpisodeId = episodeId === "title" ? null : episodeId;
  const progress = initialProgress.find((p) => p.episode_id === activeEpisodeId);
  const index = episodes.findIndex((e) => e.id === episodeId);
  const current = episodes[index];

  function go(delta: number) {
    const next = episodes[index + delta];
    if (next) { setEpisodeId(next.id); setSourceId(""); }
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-black ring-1 ring-white/5">
      {options.length > 0 ? (
        <PlaybackMedia key={`${selected?.id}-${activeEpisodeId ?? "title"}`} source={selected} titleId={titleId}
          episodeId={activeEpisodeId} progress={progress} canSaveProgress={canSaveProgress}
          onFinished={() => { if (autoNext) go(1); }} />
      ) : (
        <div className="grid aspect-video place-items-center px-6 text-center text-sm text-text-secondary">Для этой серии пока нет источника</div>
      )}

      <div className="space-y-4 bg-surface-1 p-4">
        {/* Панель управления */}
        <div className="flex flex-wrap items-center gap-2">
          {episodes.length > 0 && <>
            <button type="button" onClick={() => go(-1)} disabled={index <= 0} className="h-10 rounded-lg bg-surface-2 px-3 text-sm disabled:opacity-40">◀ Пред.</button>
            <span className="px-2 text-sm font-semibold">{current ? `Серия ${current.episode_number}${current.name ? ` · ${current.name}` : ""}` : "Весь тайтл"}</span>
            <button type="button" onClick={() => go(1)} disabled={index < 0 || index >= episodes.length - 1} className="h-10 rounded-lg bg-surface-2 px-3 text-sm disabled:opacity-40">След. ▶</button>
          </>}
          <label className="ml-auto flex items-center gap-2 text-xs text-text-secondary">
            <input type="checkbox" checked={autoNext} onChange={(e) => setAutoNext(e.target.checked)} className="accent-accent" /> Автопереход
          </label>
        </div>

        {/* Озвучки / источники вкладками */}
        {options.length > 1 && (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Источник">
            {options.map((s) => (
              <button key={s.id} type="button" role="tab" aria-selected={s.id === selected?.id} onClick={() => setSourceId(s.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${s.id === selected?.id ? "bg-accent-strong text-white" : "bg-surface-2 text-text-secondary hover:text-white"}`}>
                {[s.provider_name, s.language_code?.toUpperCase(), s.quality_label].filter(Boolean).join(" · ") || s.source_format.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Сетка серий, как в Anixart */}
        {episodes.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-text-muted">Серии · {episodes.length}</p>
            <div className="grid max-h-64 grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-1.5 overflow-y-auto pr-1">
              {episodes.map((e) => {
                const active = e.id === episodeId;
                const seen = watched.has(e.id);
                return (
                  <button key={e.id} type="button" title={e.name ?? undefined} onClick={() => { setEpisodeId(e.id); setSourceId(""); }}
                    className={`relative h-11 rounded-lg text-sm font-semibold transition ${active ? "bg-accent-strong text-white" : seen ? "bg-surface-2 text-text-muted" : "bg-surface-2 text-white hover:bg-surface-hover"}`}>
                    {e.episode_number}
                    {seen && !active && <span className="absolute right-1 top-0.5 text-[9px] text-accent">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {progress && !progress.completed_at && selected?.source_format !== "embed" && (
          <p className="text-xs text-text-muted">Продолжение с {formatTime(progress.position_seconds)}</p>
        )}
      </div>
    </div>
  );
}

function PlaybackMedia({ source, titleId, episodeId, progress, canSaveProgress, onFinished }: { source?: VideoSource; titleId: string; episodeId: string | null; progress?: VideoProgress; canSaveProgress: boolean; onFinished?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef(0);
  const sourceFormat = source?.source_format;
  const sourceUrl = source?.source_url;

  useEffect(() => {
    let disposed = false;
    let engine: import("hls.js").default | null = null;
    let dashEngine: import("dashjs").MediaPlayerClass | null = null;
    const video = videoRef.current;
    if (!video || !sourceUrl || (sourceFormat !== "hls" && sourceFormat !== "dash")) return;

    if (sourceFormat === "dash") {
      void import("dashjs").then(({ MediaPlayer }) => {
        if (disposed) return;
        dashEngine = MediaPlayer().create();
        dashEngine.on("error", () => setError("Не удалось загрузить поток. Проверь источник или попробуй позже."));
        dashEngine.initialize(video, sourceUrl, false);
      }).catch(() => setError("Не удалось загрузить модуль видеоплеера."));
      return () => {
        disposed = true;
        dashEngine?.reset();
      };
    }

    void import("hls.js").then(({ default: Hls }) => {
      if (disposed) return;
      if (Hls.isSupported()) {
        engine = new Hls();
        engine.loadSource(sourceUrl);
        engine.attachMedia(video);
        engine.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) setError("Не удалось загрузить поток. Проверь источник или попробуй позже.");
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = sourceUrl;
      } else {
        setError("Этот браузер не поддерживает HLS-воспроизведение.");
      }
    }).catch(() => setError("Не удалось загрузить модуль видеоплеера."));

    return () => {
      disposed = true;
      engine?.destroy();
      dashEngine?.reset();
    };
  }, [sourceFormat, sourceUrl]);

  function persist(video: HTMLVideoElement, completed = false, force = false) {
    if (!canSaveProgress || !source || (!force && video.currentTime - lastSaved.current < 10)) return;
    lastSaved.current = video.currentTime;
    void saveVideoProgress(titleId, episodeId, video.currentTime, Number.isFinite(video.duration) ? video.duration : null, completed).then((result) => {
      if (!result.ok) setError("Не удалось сохранить прогресс. Проверь соединение и войди в аккаунт.");
    });
  }

  function restore(video: HTMLVideoElement) {
    if (!progress || progress.completed_at || video.currentTime > 0) return;
    const limit = Number.isFinite(video.duration) ? Math.max(0, video.duration - 5) : progress.position_seconds;
    const position = Math.min(progress.position_seconds, limit);
    if (position > 5) video.currentTime = position;
    lastSaved.current = position;
  }

  if (source?.source_format === "embed") {
    const embed = getTrustedEmbedUrl(source.source_url);
    return embed ? (
      <div className="aspect-video bg-black">
        <iframe
          title="Видеоплеер"
          src={embed.url}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allow={embed.allow}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    ) : (
      <div className="grid aspect-video place-items-center px-6 text-center">
        <div>
          <p className="font-semibold">Провайдер не поддерживается</p>
          <p className="mt-2 text-sm text-text-secondary">Встроенный режим разрешён только для YouTube NoCookie, Vimeo и RuTube.</p>
        </div>
      </div>
    );
  }

  return <div className="relative bg-black"><video ref={videoRef} className="aspect-video w-full" controls playsInline preload="metadata" src={source?.source_format === "mp4" ? source.source_url : undefined} onLoadedMetadata={(event) => restore(event.currentTarget)} onTimeUpdate={(event) => persist(event.currentTarget)} onPause={(event) => { if (!event.currentTarget.ended) persist(event.currentTarget, false, true); }} onEnded={(event) => { persist(event.currentTarget, true, true); onFinished?.(); }} />{error && <p role="alert" className="absolute inset-x-0 bottom-12 mx-auto w-fit rounded-lg bg-black/85 px-4 py-2 text-sm text-danger">{error}</p>}</div>;
}

function getTrustedEmbedUrl(rawUrl: string): { url: string; allow: string } | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (url.hostname === "www.youtube-nocookie.com" && /^\/embed\/[\w-]{6,}$/.test(url.pathname)) {
      return { url: url.toString(), allow: "autoplay; fullscreen; picture-in-picture" };
    }
    if (url.hostname === "player.vimeo.com" && /^\/video\/\d+$/.test(url.pathname)) {
      return { url: url.toString(), allow: "autoplay; fullscreen; picture-in-picture" };
    }
    if (
      (url.hostname === "rutube.ru" || url.hostname === "www.rutube.ru") &&
      /^\/play\/embed\/[a-f\d]{32}\/?$/i.test(url.pathname)
    ) {
      return { url: url.toString(), allow: "clipboard-write; autoplay; fullscreen; picture-in-picture" };
    }
    return null;
  } catch {
    return null;
  }
}

function formatTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
}
