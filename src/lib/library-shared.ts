import type { LibraryStatus } from "@/app/progress/actions";

/** Чистые данные и типы библиотеки: можно импортировать и в серверном, и в клиентском коде. */

export const READABLE_TYPES = new Set(["manga", "manhwa", "manhua", "light_novel", "web_novel", "book"]);

export const isReadable = (contentType: string) => READABLE_TYPES.has(contentType);

export const statusLabels: Record<LibraryStatus, string> = {
  planned: "Запланировано",
  in_progress: "В процессе",
  completed: "Завершено",
  on_hold: "Отложено",
  dropped: "Брошено",
};

export const statusOrder: LibraryStatus[] = ["in_progress", "planned", "completed", "on_hold", "dropped"];

export type LibraryProgress = {
  kind: "video" | "read";
  /** «Серия 5», «Глава 12» или общая подпись, если юнит неизвестен. */
  label: string;
  percent: number;
  done: boolean;
};

export type LibraryItem = {
  titleId: string;
  slug: string;
  name: string;
  coverUrl: string | null;
  contentType: string;
  releaseYear: number | null;
  status: LibraryStatus;
  favorite: boolean;
  updatedAt: string;
  rating: number | null;
  progress: LibraryProgress | null;
};

export type ContinueItem = {
  titleId: string;
  href: string;
  name: string;
  coverUrl: string | null;
  label: string;
  percent: number;
  kind: "video" | "read";
};

export type LibrarySummary = {
  total: number;
  favorites: number;
  completed: number;
  passedUnits: number;
};

export type LibraryData = {
  items: LibraryItem[];
  continueItems: ContinueItem[];
  summary: LibrarySummary;
  truncated: boolean;
};
