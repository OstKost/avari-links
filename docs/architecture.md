# Карта проекта для агента

Код реализует Avari URL shortener & link analytics platform на чистой архитектуре (Go/SQLite API + React UI).

## Где искать

- Запуск и сборка зависимостей: `apps/api/cmd/server/main.go`.
- Маршруты и healthcheck: `apps/api/internal/handler/router.go`; HTTP DTO и ошибки: `dto.go` рядом.
- Доменные контракты: `apps/api/internal/domain/link.go`; use cases: `internal/service/link_service.go`.
- SQL: `internal/repository/sqlite/link_repository.go`; подключение и embedded Goose: `internal/database/`.
- Корень UI: `apps/web/src/App.tsx`; layout: `src/app/`; взаимодействия: `src/features/`.
- TypeScript-контракт, запросы и кеш: `src/entities/link/{types,api,queries}.ts`; Axios: `src/shared/api/client.ts`.
- Стили и компоненты: `src/index.css`, `src/shared/components/`; локальные предпочтения: `src/shared/store/`.

## Границы, которые важно сохранять

HTTP → service → repository; интерфейсы и ошибки находятся в domain. Транспорт и SQL не должны проникать в бизнес-правила. На UI данные сервера проходят через TanStack Query, локальные предпочтения — через Zustand.

Контракт Go и TypeScript пока синхронизируется вручную. При изменении JSON проверять обе стороны, nullable/optional поля, HTTP status и ошибки; будущая генерация клиента требует отдельного решения. Swagger-файл в текущем коде минимален: наличие Swagger UI не означает полноту спецификации.

SQLite работает через `modernc.org/sqlite`; production build без CGO. Текущий код задаёт pragmas в DSN и ограничивает пул одним соединением; фактическое применение pragmas нужно проверять запросом при изменении подключения. Click tracking запускается в goroutine — учитывать завершение процесса и eventual consistency счётчика.

## Что ещё не доказано

Локальные Go-тесты, lint и сборка не доказывают production readiness. На момент внедрения harness отсутствует отдельный web test runner; нет доказательств авторизации, нагрузочной устойчивости или полного E2E покрытия. CI и Docker используют разные версии инструментов; отдельная нормализация toolchain полезна перед релизом.

Для долговременного изменения архитектуры использовать [ADR](decisions/TEMPLATE.md); для разработки среза — [задачу](tasks/TEMPLATE.md).
