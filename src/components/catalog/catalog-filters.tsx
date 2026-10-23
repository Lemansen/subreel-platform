"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { contentLabels } from "@/lib/catalog";
import {
  DEFAULT_SORT,
  SORT_OPTIONS,
  TYPE_GROUPS,
  activeFilterCount,
  catalogHref,
  pluralRu,
  readYear,
  type CatalogFilterState,
  type SortValue,
} from "@/lib/catalog-query";

type Genre = { id: string; name: string; slug: string };

const DIALOG_ID = "catalog-filters";
const GENRES_COLLAPSED = 10;

/** Кнопка «Фильтры (n)» для мобильных: открывает ту же панель в нижнем drawer. */
export function FiltersButton({ count }: { count: number }) {
  return (
    <button
      type="button"
      onClick={() => (document.getElementById(DIALOG_ID) as HTMLDialogElement | null)?.showModal()}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border-subtle bg-surface-1 px-4 text-sm font-semibold transition hover:bg-surface-2 lg:hidden"
    >
      Фильтры
      {count > 0 && (
        <span aria-label={`выбрано: ${count}`} className="rounded-full bg-accent-strong px-2 py-0.5 text-xs text-white">
          {count}
        </span>
      )}
    </button>
  );
}

function Row({
  id,
  type,
  name,
  label,
  checked,
  onChange,
  hint,
}: {
  id: string;
  type: "checkbox" | "radio";
  name?: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  hint?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-text-secondary transition hover:bg-surface-2 hover:text-foreground has-checked:text-foreground"
    >
      <input id={id} name={name} type={type} checked={checked} onChange={onChange} className="size-4 shrink-0 accent-accent" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="shrink-0 text-xs text-text-muted">{hint}</span>}
    </label>
  );
}

export function CatalogFilters({ genres, filters, total }: { genres: Genre[]; filters: CatalogFilterState; total: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Мгновенный отклик: пока сервер перерисовывает выдачу, галочки уже стоят как надо.
  const [view, setView] = useOptimistic(filters);
  const [showAllGenres, setShowAllGenres] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Поля годов — черновик: применяются по Enter, при уходе из поля или кнопкой.
  const yearKey = `${filters.yearFrom ?? ""}-${filters.yearTo ?? ""}`;
  const [syncedYearKey, setSyncedYearKey] = useState(yearKey);
  const [from, setFrom] = useState(filters.yearFrom?.toString() ?? "");
  const [to, setTo] = useState(filters.yearTo?.toString() ?? "");
  if (syncedYearKey !== yearKey) {
    setSyncedYearKey(yearKey);
    setFrom(filters.yearFrom?.toString() ?? "");
    setTo(filters.yearTo?.toString() ?? "");
  }

  const parsedFrom = from ? readYear(from) : null;
  const parsedTo = to ? readYear(to) : null;
  const yearInvalid = (from !== "" && parsedFrom === null) || (to !== "" && parsedTo === null);
  const yearDirty = from !== (filters.yearFrom?.toString() ?? "") || to !== (filters.yearTo?.toString() ?? "");
  const count = activeFilterCount(view);

  function apply(next: CatalogFilterState) {
    startTransition(() => {
      setView(next);
      router.replace(catalogHref(next), { scroll: false });
    });
  }

  function toggle(list: string[], value: string) {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  function commitYears() {
    if (yearInvalid || !yearDirty) return;
    let a = parsedFrom;
    let b = parsedTo;
    if (a !== null && b !== null && a > b) [a, b] = [b, a];
    apply({ ...view, yearFrom: a, yearTo: b });
  }

  const visibleGenres = showAllGenres ? genres : genres.filter((genre, index) => index < GENRES_COLLAPSED || view.genres.includes(genre.slug));
  const legend = "mb-2 text-sm font-semibold";

  function fields(p: string) {
    return (
      <div className="space-y-6">
        <fieldset>
          <legend className={legend}>Сортировка</legend>
          {SORT_OPTIONS.map((option) => (
            <Row
              key={option.value}
              id={`${p}-sort-${option.value}`}
              type="radio"
              name={`${p}-sort`}
              label={option.label}
              hint={option.value === DEFAULT_SORT ? "по умолчанию" : undefined}
              checked={view.sort === option.value}
              onChange={() => apply({ ...view, sort: option.value as SortValue })}
            />
          ))}
        </fieldset>

        <fieldset className="border-t border-border-subtle pt-5">
          <legend className={legend}>Тип</legend>
          {TYPE_GROUPS.map((group) => (
            <div key={group.label} className="mt-1 first:mt-0">
              <p className="px-2 pb-1 pt-2 text-xs text-text-muted">{group.label}</p>
              {group.types.map((type) => (
                <Row
                  key={type}
                  id={`${p}-type-${type}`}
                  type="checkbox"
                  label={contentLabels[type] ?? type}
                  checked={view.types.includes(type)}
                  onChange={() => apply({ ...view, types: toggle(view.types, type) })}
                />
              ))}
            </div>
          ))}
        </fieldset>

        <fieldset className="border-t border-border-subtle pt-5">
          <legend className={legend}>Год выхода</legend>
          <div className="flex items-start gap-2">
            {(
              [
                ["from", "От", from, setFrom],
                ["to", "До", to, setTo],
              ] as const
            ).map(([key, label, value, setValue]) => (
              <div key={key} className="min-w-0 flex-1">
                <label htmlFor={`${p}-year-${key}`} className="mb-1 block text-xs text-text-muted">
                  {label}
                </label>
                <input
                  id={`${p}-year-${key}`}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder={key === "from" ? "1990" : "2025"}
                  value={value}
                  aria-invalid={value !== "" && readYear(value) === null}
                  onChange={(event) => setValue(event.target.value.replace(/\D/g, ""))}
                  onBlur={commitYears}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitYears();
                    }
                  }}
                  className="h-11 w-full rounded-xl border border-border-subtle bg-background px-3 text-sm outline-none placeholder:text-text-muted focus:border-accent aria-invalid:border-danger"
                />
              </div>
            ))}
          </div>
          {yearInvalid && (
            <p role="alert" className="mt-2 text-xs text-danger">
              Введи год из четырёх цифр, от 1800 до 2200.
            </p>
          )}
          {yearDirty && !yearInvalid && (
            <button type="button" onClick={commitYears} className="mt-3 min-h-10 rounded-lg bg-accent-strong px-4 text-sm font-semibold text-white transition hover:brightness-110">
              Применить
            </button>
          )}
        </fieldset>

        {genres.length > 0 && (
          <fieldset className="border-t border-border-subtle pt-5">
            <legend className={legend}>Жанры</legend>
            <p className="mb-2 px-2 text-xs leading-5 text-text-muted">Показываем тайтлы хотя бы с одним из выбранных жанров.</p>
            {visibleGenres.map((genre) => (
              <Row
                key={genre.id}
                id={`${p}-genre-${genre.slug}`}
                type="checkbox"
                label={genre.name}
                checked={view.genres.includes(genre.slug)}
                onChange={() => apply({ ...view, genres: toggle(view.genres, genre.slug) })}
              />
            ))}
            {genres.length > GENRES_COLLAPSED && (
              <button
                type="button"
                aria-expanded={showAllGenres}
                onClick={() => setShowAllGenres((value) => !value)}
                className="mt-1 min-h-10 px-2 text-sm text-accent transition hover:brightness-125"
              >
                {showAllGenres ? "Свернуть" : `Показать все (${genres.length})`}
              </button>
            )}
          </fieldset>
        )}
      </div>
    );
  }

  const status = pending ? (
    <span role="status" className="text-xs text-text-muted">
      Обновляем…
    </span>
  ) : count > 0 ? (
    <Link href="/catalog" className="text-sm text-accent transition hover:brightness-125">
      Сбросить
    </Link>
  ) : null;

  return (
    <>
      <aside aria-label="Фильтры каталога" className="hidden lg:block">
        <div
          aria-busy={pending}
          className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain rounded-2xl border border-border-subtle bg-surface-1/70 p-5 backdrop-blur"
        >
          <div className="mb-5 flex min-h-6 items-center justify-between gap-3">
            <h2 className="text-base font-semibold">
              Фильтры
              {count > 0 && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">{count}</span>}
            </h2>
            {status}
          </div>
          {fields("d")}
        </div>
      </aside>

      <dialog
        ref={dialogRef}
        id={DIALOG_ID}
        aria-label="Фильтры каталога"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="m-0 mt-auto max-h-[88dvh] w-full max-w-none flex-col overflow-hidden rounded-t-3xl border-t border-border-subtle bg-surface-1 p-0 text-foreground backdrop:bg-black/70 open:flex lg:hidden"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <h2 className="text-base font-semibold">
            Фильтры
            {count > 0 && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">{count}</span>}
          </h2>
          <button
            type="button"
            aria-label="Закрыть фильтры"
            onClick={() => dialogRef.current?.close()}
            className="grid size-11 place-items-center rounded-xl text-text-secondary transition hover:bg-surface-2 hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{fields("m")}</div>
        <div className="flex items-center gap-3 border-t border-border-subtle px-5 py-4">
          {count > 0 && (
            <Link href="/catalog" onClick={() => dialogRef.current?.close()} className="inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm font-medium transition hover:bg-surface-2">
              Сбросить
            </Link>
          )}
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="min-h-11 flex-1 rounded-xl bg-accent-strong px-4 text-sm font-semibold text-white transition hover:brightness-110"
          >
            {pending ? "Обновляем…" : `Показать ${total} ${pluralRu(total, ["произведение", "произведения", "произведений"])}`}
          </button>
        </div>
      </dialog>
    </>
  );
}
