# Письма авторизации SubReel

Шаблоны писем оформлены на русском языке в стиле SubReel: тёмная шапка, фиолетовый акцент, адаптивная таблица и встроенные стили для почтовых клиентов. Все ссылки используют стандартную переменную Supabase `{{ .ConfirmationURL }}`, письмо повторной проверки использует `{{ .Token }}`.

## Шаблоны и темы

| Шаблон Supabase | Файл | Тема письма |
|---|---|---|
| Confirm signup | `supabase/templates/confirmation.html` | Подтвердите адрес электронной почты — SubReel |
| Reset Password | `supabase/templates/recovery.html` | Смена пароля аккаунта SubReel |
| Magic Link | `supabase/templates/magic_link.html` | Войдите в SubReel |
| Invite User | `supabase/templates/invite.html` | Вас пригласили в SubReel |
| Change Email Address | `supabase/templates/email_change.html` | Подтвердите новый адрес почты — SubReel |
| Reauthentication | `supabase/templates/reauthentication.html` | Код подтверждения SubReel |

## Применение в Supabase

Откройте проект → **Authentication → Email Templates**. Для каждого типа письма вставьте HTML из соответствующего файла и укажите тему из таблицы. Сохраните изменения.

Настройки проекта в текущей сессии потребовали повторного входа в Supabase, поэтому сохранённые здесь шаблоны пока не были применены к Dashboard. Для редактирования шаблонов у проекта должен быть доступен соответствующий режим настройки почты; на новых Free-проектах стандартный SMTP может не разрешать менять шаблоны, тогда потребуется собственный SMTP.

Проверьте в **Authentication → URL Configuration**, что Site URL и разрешённые redirect URL ведут на нужный адрес SubReel: ссылки подтверждения и восстановления должны возвращать пользователя в приложение.

