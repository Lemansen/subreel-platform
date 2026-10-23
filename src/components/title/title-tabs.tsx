"use client";

import { useRef, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";

export type TabItem = { id: string; label: string; count?: number; content: ReactNode };

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const readHash = () => window.location.hash.slice(1);
const serverHash = () => "";

/** Вкладки с ARIA-ролями, стрелками/Home/End и синхронизацией с #hash (ссылку на «Отзывы» можно отправить). */
export function TitleTabs({ tabs }: { tabs: TabItem[] }) {
  const hash = useSyncExternalStore(subscribe, readHash, serverHash);
  const active = tabs.some((tab) => tab.id === hash) ? hash : tabs[0].id;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function select(id: string) {
    window.history.replaceState(null, "", `#${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  function onKeyDown(event: KeyboardEvent, index: number) {
    const n = tabs.length;
    const next =
      event.key === "ArrowRight" ? (index + 1) % n
      : event.key === "ArrowLeft" ? (index - 1 + n) % n
      : event.key === "Home" ? 0
      : event.key === "End" ? n - 1
      : -1;
    if (next < 0) return;
    event.preventDefault();
    select(tabs[next].id);
    buttons.current[next]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Разделы тайтла"
        className="sticky top-16 z-30 -mx-5 flex gap-1 overflow-x-auto border-b border-border-subtle bg-background/95 px-5 shadow-sm backdrop-blur-xl sm:mx-0 sm:px-0"
      >
        {tabs.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(node) => { buttons.current[index] = node; }}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-[15px] font-medium transition-colors ${
                selected ? "border-accent text-foreground" : "border-transparent text-text-secondary hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${selected ? "bg-accent/20 text-accent" : "bg-surface-2 text-text-muted"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== active}
          tabIndex={0}
          className="pt-8"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
