"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { saveVideoProgress } from "@/app/progress/actions";

type Episode = { id: string; episode_number: number; name: string | null; season_id: string | null };
type VideoSource = { id: string; episode_id: string | null; source_url: string; source_format: "hls" | "dash" | "mp4" | "embed"; provider_name: string | null; language_code: string | null; quality_label: string | null };
type VideoProgress = { episode_id: string | null; position_seconds: number; duration_seconds: number | null; completed_at: string | null; updated_at: string };

export function VideoPlayback({ titleId, episodes, sources, initialProgress, canSaveProgress }: { titleId: string; episodes: Episode[]; sources: VideoSource[]; initialProgress: VideoProgress[]; canSaveProgress: boolean }) {
  const playable = sources.filter((source) => source.source_format === "mp4" || source.source_format === "hls" || source.source_format === "dash" || source.source_format === "embed");
  const latestProgress = initialProgress[0];
  const resumeTarget = latestProgress?.episode_id && episodes.some((episode) => episode.id === latestProgress.episode_id)
    ? latestProgress.episode_id
    : latestProgress && latestProgress.episode_id === null && playable.some((source) => source.episode_id === null)
      ? "title"
      : null;
  const initialEpisode = resumeTarget ?? episodes.find((episode) => playable.some((source) => source.episode_id === episode.id))?.id ?? "title";
  const [episodeId, setEpisodeId] = useState(initialEpisode);
  const [sourceId, setSourceId] = useState("");
  const options = useMemo(() => {
    const specific = episodeId === "title" ? [] : playable.filter((source) => source.episode_id === episodeId);
    return specific.length ? specific : playable.filter((source) => source.episode_id === null);
  }, [episodeId, playable]);
  const selected = options.find((source) => source.id === sourceId) ?? options[0];
  const activeEpisodeId = episodeId === "title" ? null : episodeId;
  const progress = initialProgress.find((item) => item.episode_id === activeEpisodeId);

  return (
    <div className="bg-black">
      {episodes.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle bg-surface-1 px-4 py-3">
          <label htmlFor="watch-episode" className="text-sm text-text-secondary">Серия</label>
          <select id="watch-episode" value={episodeId} onChange={(event) => { setEpisodeId(event.target.value); setSourceId(""); }} className="min-h-10 min-w-48 rounded-lg border border-border-subtle bg-background px-3 text-sm text-white">
            <option value="title">Весь тайтл</option>
            {episodes.map((episode) => <option key={episode.id} value={episode.id}>{episode.episode_number}{episode.name ? ` · ${episode.name}` : ""}</option>)}
          </select>
        </div>
      )}
      {options.length > 0 ? (
        <>
          {options.length > 1 && <div className="flex flex-wrap items-center gap-3 px-4 py-3"><label htmlFor="watch-source" className="text-sm text-text-secondary">Источник</label><select id="watch-source" value={selected?.id} onChange={(event) => setSourceId(event.target.value)} className="min-h-11 min-w-48 rounded-lg border border-border-subtle bg-surface-1 px-3 text-sm text-foreground">{options.map((source) => <option key={source.id} value={source.id}>{[source.provider_name, source.language_code, source.quality_label, source.source_format.toUpperCase()].filter(Boolean).join(" · ")}</option>)}</select></div>}
          <PlaybackMedia key={`${selected?.id}-${activeEpisodeId ?? "title"}`} source={selected} titleId={titleId} episodeId={activeEpisodeId} progress={progress} canSaveProgress={canSaveProgress} />
          <p className="px-4 py-2 text-xs text-text-muted">{selected?.source_format === "embed" ? "Безопасный embed-плеер. Позиция воспроизведения у внешнего провайдера не синхронизируется." : progress && !progress.completed_at ? `Продолжение с ${formatTime(progress.position_seconds)}` : selected?.source_format === "hls" || selected?.source_format === "dash" ? "Если поток не запускается, проверь доступность источника и попробуй обновить страницу." : "Источник проверен редактором SubReel."}</p>
        </>
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center px-6 text-center">
          <h2 className="text-lg font-semibold">Для этой серии нет совместимого источника</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-text-secondary">Найден только внешний embed, который нельзя безопасно встроить в плеер.</p>
        </div>
      )}
    </div>
  );
}

function PlaybackMedia({ source, titleId, episodeId, progress, canSaveProgress }: { source?: VideoSource; titleId: string; episodeId: string | null; progress?: VideoProgress; canSaveProgress: boolean }) {
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

  return <div className="relative bg-black"><video ref={videoRef} className="aspect-video w-full" controls playsInline preload="metadata" src={source?.source_format === "mp4" ? source.source_url : undefined} onLoadedMetadata={(event) => restore(event.currentTarget)} onTimeUpdate={(event) => persist(event.currentTarget)} onPause={(event) => { if (!event.currentTarget.ended) persist(event.currentTarget, false, true); }} onEnded={(event) => persist(event.currentTarget, true, true)} />{error && <p role="alert" className="absolute inset-x-0 bottom-12 mx-auto w-fit rounded-lg bg-black/85 px-4 py-2 text-sm text-danger">{error}</p>}</div>;
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
