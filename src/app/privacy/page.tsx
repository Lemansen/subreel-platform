import type { Metadata } from "next";
import Link from "next/link";
import { CookieSettingsButton } from "@/components/cookie-consent";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Конфиденциальность и cookie",
  description: "Информация о cookie, авторизации и обработке данных на SubReel.",
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <Link href="/" className="text-sm text-violet-300 hover:text-violet-200">← На главную</Link>
        <div className="mt-5 rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-[#111119] to-sky-500/5 p-6 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">SubReel · Правовая информация</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Конфиденциальность и cookie</h1>
          <p className="mt-4 max-w-2xl leading-7 text-white/65">
            Здесь описано, как сайт использует технические данные, необходимые для работы аккаунта,
            и как изменить сохранённый выбор cookie.
          </p>
          <div className="mt-6">
            <CookieSettingsButton />
          </div>
        </div>

        <div className="mt-8 space-y-5">
          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h2 className="text-xl font-bold text-white">Какие данные нужны для работы сайта</h2>
            <p className="mt-3 leading-7 text-white/70">
              При входе в аккаунт сервис авторизации может сохранять технические cookie или аналогичные
              данные сессии. Они нужны, чтобы поддерживать авторизацию, защищать сессию и обеспечивать
              работу функций аккаунта. Если удалить такие данные в браузере, может потребоваться войти
              повторно.
            </p>
          </section>

          <section id="cookies" className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h2 className="text-xl font-bold text-white">Категории cookie</h2>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-semibold text-white">Необходимые</h3>
                <p className="mt-1 leading-6 text-white/65">Используются для авторизации, безопасности и основных функций. Их нельзя отключить через настройки согласия, не нарушив работу этих функций.</p>
              </div>
              <div>
                <h3 className="font-semibold text-white">Аналитические и рекламные</h3>
                <p className="mt-1 leading-6 text-white/65">Панель согласия позволяет сохранить предпочтения для этих категорий. На момент публикации этой страницы аналитические и рекламные инструменты через панель SubReel не подключены; сохранение предпочтения само по себе не запускает такие инструменты.</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h2 className="text-xl font-bold text-white">Как изменить выбор</h2>
            <p className="mt-3 leading-7 text-white/70">
              Можно изменить выбор в панели cookie на сайте. Также можно удалить cookie и данные сайта
              в настройках браузера. После очистки данных согласие может быть запрошено снова, а вход
              в аккаунт — сброшен.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
            <h2 className="text-xl font-bold text-white">Обновления и вопросы</h2>
            <p className="mt-3 leading-7 text-white/70">
              Эта страница описывает текущую реализацию и должна обновляться при подключении новых
              поставщиков аналитики, рекламы или других инструментов обработки данных. Не добавляйте
              необязательные технологии до получения соответствующего согласия пользователя.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
