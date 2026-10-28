"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Consent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  savedAt: string;
};

const STORAGE_KEY = "subreel-cookie-consent-v1";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const reopen = () => { setSettingsOpen(true); setVisible(true); };
    window.addEventListener("subreel-cookie-settings-open", reopen);
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        setVisible(true);
        return;
      }

      const parsed = JSON.parse(saved) as Partial<Consent>;
      setAnalytics(parsed.analytics === true);
      setMarketing(parsed.marketing === true);
    } catch {
      setVisible(true);
    }
    return () => window.removeEventListener("subreel-cookie-settings-open", reopen);
  }, []);

  function saveConsent(nextAnalytics: boolean, nextMarketing: boolean) {
    const consent: Consent = {
      necessary: true,
      analytics: nextAnalytics,
      marketing: nextMarketing,
      savedAt: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    } finally {
      setAnalytics(nextAnalytics);
      setMarketing(nextMarketing);
      setVisible(false);
      setSettingsOpen(false);
    }
  }

  if (!visible) return null;

  return (
    <aside
      aria-label="Настройки cookie"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-5xl rounded-2xl border border-white/10 bg-[#111119]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:inset-x-6 sm:bottom-6 sm:p-5"
      role="dialog"
      aria-modal="false"
      aria-describedby="cookie-consent-description"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-violet-500/15 text-lg text-violet-200">☷</span>
            <h2 className="text-base font-semibold text-white">Настройки cookie</h2>
          </div>
          <p id="cookie-consent-description" className="max-w-3xl text-sm leading-6 text-white/70">
            SubReel использует необходимые cookie для входа в аккаунт и сохранения защищённой сессии.
            Необязательные категории можно настроить отдельно. Сейчас аналитические и рекламные
            инструменты на этой панели не подключены.
          </p>
          <Link href="/privacy#cookies" className="mt-2 inline-flex text-sm font-medium text-violet-300 underline decoration-violet-300/40 underline-offset-4 hover:text-violet-200">
            Подробнее о cookie и конфиденциальности
          </Link>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:w-52">
          <button type="button" onClick={() => saveConsent(true, true)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500">
            Разрешить все
          </button>
          <button type="button" onClick={() => saveConsent(false, false)} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5">
            Только необходимые
          </button>
          <button type="button" onClick={() => setSettingsOpen((open) => !open)} aria-expanded={settingsOpen} className="rounded-xl px-4 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white">
            {settingsOpen ? "Скрыть настройки" : "Настроить"}
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-white">Необходимые</p>
              <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">Всегда включены</span>
            </div>
            <p className="mt-1 text-sm leading-5 text-white/60">Нужны для авторизации, безопасности и работы сайта.</p>
          </div>
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <span>
              <span className="block font-medium text-white">Аналитические</span>
              <span className="mt-1 block text-sm leading-5 text-white/60">Разрешение на необязательную статистику посещений, если она будет подключена.</span>
            </span>
            <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} className="mt-1 size-4 accent-violet-500" />
          </label>
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:col-span-2">
            <span>
              <span className="block font-medium text-white">Рекламные</span>
              <span className="mt-1 block text-sm leading-5 text-white/60">Разрешение на необязательные рекламные технологии, если они появятся.</span>
            </span>
            <input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} className="mt-1 size-4 accent-violet-500" />
          </label>
          <div className="sm:col-span-2 sm:flex sm:justify-end">
            <button type="button" onClick={() => saveConsent(analytics, marketing)} className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 sm:w-auto">
              Сохранить выбор
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

export function CookieSettingsButton() {
  function reopenSettings() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new Event("subreel-cookie-settings-open"));
    } catch {
      window.location.reload();
    }
  }

  return (
    <button type="button" onClick={reopenSettings} className="text-left text-sm text-white/60 transition hover:text-white">
      Настройки cookie
    </button>
  );
}
