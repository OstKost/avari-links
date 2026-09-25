# Задача: Premium-статус сессии, короткие коды от 4 символов и 2 года хранения

Статус: done

## Результат и границы

Реализована поддержка Premium-статуса для анонимных сессий:
1. Пользователям с Premium разрешено создание ссылок с кастомным кодом от 4 символов (обычные пользователи — от 8 символов).
2. Сессии Premium-пользователей защищены от удаления планировщиком автоочистки (никогда не удаляются при неактивности).
3. Ссылки Premium-пользователей сохраняются 2 года даже при отсутствии переходов и заходов в профиль (вместо 100 дней для базового тарифа).
4. В веб-интерфейсе реализовано отображение Premium-статуса (золотой бейдж `★ PREMIUM` в хедере и в окне профиля) и понятная валидация формы.
5. Для администратора подготовлен инструментарий ручной выдачи Premium-статуса в базе данных.

## Приёмка

- [x] Миграция `00004_add_premium_to_sessions.sql`: колонка `is_premium INTEGER NOT NULL DEFAULT 0` и индекс `idx_sessions_is_premium`.
- [x] Хранилище: метод очистки `CleanupInactiveSessions` исключает сессии с `is_premium = 1` из удаления, а для ссылок Premium применяет порог 2 года.
- [x] Бэкенд: валидация слага 4–30 символов в сервисе; отказ `403 ErrPremiumSlugRequired` для кодов длины 4–7 у пользователей без Premium.
- [x] API: сериализация флага `is_premium` в DTO сессий (`/me`, `/restore`, `/session`).
- [x] Фронтенд: динамическая схема валидации `getCreateLinkSchema(isPremium)` с информированием о необходимости Premium для кодов 4–7 символов.
- [x] Интерфейс: отображение бейджа `★ PREMIUM` в `Navbar` и карточки привилегий в `SessionModal`.
- [x] Документация и скрипты: подготовлено руководство [`docs/administration.md`](file:///Volumes/KingstonM2/Projects/avari-links/docs/administration.md) и CLI-скрипт [`scripts/admin.sh`](file:///Volumes/KingstonM2/Projects/avari-links/scripts/admin.sh).

## Контракт и порядок работы

1. **База данных (`apps/api/internal/database/migrations`)**:
   - Миграция `00004_add_premium_to_sessions.sql`.
2. **Домен и репозиторий (`apps/api/internal/domain`, `apps/api/internal/repository/sqlite`)**:
   - Поле `IsPremium bool` в структурах `Session` и `CreateLinkDTO`.
   - Обновление SQL-запросов `Create`, `GetByID`, `GetByKeyHash`, `CleanupInactiveSessions`.
3. **Бизнес-логика и API (`apps/api/internal/service`, `apps/api/internal/handler`)**:
   - `domain.ErrPremiumSlugRequired` (HTTP 403 Forbidden).
   - Поддержка проверки Premium в `LinkService.CreateLink`.
4. **Веб-интерфейс (`apps/web`)**:
   - Тип `Session.is_premium` в `entities/session/types.ts`.
   - Zod-валидация и подсказка в `CreateLinkForm.tsx`.
   - Золотой индикатор в `Navbar.tsx` и `SessionModal.tsx`.
5. **Скрипты и документация (`scripts/`, `docs/`)**:
   - `scripts/admin.sh` для управления через терминал.
   - `docs/administration.md` с описанием SQL-команд и хеширования SHA-256.

## Проверки и решения

- `make check-api` -> PASS (go-format, go-vet, go-race, go-build).
- `make check-web` -> PASS (web-lint, web-test, web-build).
- `make check` -> PASS (все 9 проверок пройдены).

## Передача контекста

Функционал полностью готов к эксплуатации. Администратор может выдавать Premium через `./scripts/admin.sh set-premium <KEY_OR_ID>` или прямыми запросами к SQLite.
