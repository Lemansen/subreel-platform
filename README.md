# SubReel Platform

Единая платформа: видео, книги и комиксы, совместный просмотр и чтение.
Стек: Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, Supabase (Postgres + Auth).

Документация: [`docs/architecture.md`](docs/architecture.md), [`docs/product-requirements.md`](docs/product-requirements.md), [`docs/roadmap-status.md`](docs/roadmap-status.md).

## Быстрый старт

1. Установите Node.js 22+ и зависимости:
   ```bash
   npm ci
   ```
2. Создайте проект в Supabase и скопируйте переменные:
   ```bash
   cp .env.example .env.local
   ```
   Заполните `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   (Project Settings → API).
3. Примените миграции в SQL Editor Supabase строго по порядку:
   - `supabase/sql/001_catalog.sql`
   - `supabase/sql/002_profiles.sql`
   - `supabase/sql/003_audit_fixes.sql`
4. В Supabase → Authentication → URL Configuration добавьте
   `http://localhost:3000/auth/callback` в Redirect URLs.
   Для сброса пароля нужен настроенный SMTP.
5. Запуск:
   ```bash
   npm run dev
   ```
   Откройте http://localhost:3000.

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер |
| `npm run typecheck` | проверка типов (`tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm run build` | production-сборка |

Те же три проверки (`typecheck`, `lint`, `build`) выполняет CI (`.github/workflows/ci.yml`).

## Структура

```
src/app/          маршруты (главная, auth, аккаунт)
src/lib/supabase/ клиенты Supabase (browser и server)
src/features/     модули по доменам: auth, catalog, read, rooms, watch
supabase/sql/     миграции базы данных
docs/             требования, архитектура, roadmap
```

## Правила

- Серверные секреты никогда не попадают в клиентский код.
- Используется только контент, на который есть права.
- Перед изменениями Next.js-кода сверяйтесь с `node_modules/next/dist/docs/` (см. `AGENTS.md`).
