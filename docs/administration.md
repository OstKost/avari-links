# Руководство администратора Avari Links

Данный документ содержит инструкции и скрипты для управления базой данных сервиса, мониторинга активности и переключения тарифов пользователей (Standard и Premium).

---

## 1. Архитектура сессий и тарифные планы

Сервис Avari Links использует концепцию **анонимных сессий** без обязательного ввода логина и пароля:
1. При первом визите пользователю автоматически генерируется уникальный мнемонический ключ (например: `cosmic-totoro-cookie-4081`).
2. В базе данных в целях безопасности хранится **только SHA-256 хеш** ключа (`key_hash`).
3. При запросах веб-клиент передает ключ в заголовке `X-Session-Key`.
4. Сессии делятся на два типа:

| Характеристика | Базовый тариф (Standard) | Тариф ★ PREMIUM |
| :--- | :--- | :--- |
| **Кастомные коды ссылок** | От **8** до 30 символов | От **4** до 30 символов |
| **Автоматическая очистка сессий** | Удаляются через **100 дней** неактивности | **Никогда не удаляются** (`is_premium = 1`) |
| **Срок хранения ссылок** | 100 дней при отсутствии переходов | **2 года** при отсутствии переходов |
| **Отображение в UI** | Обычный бейдж ключа | Золотой бейдж **`★ PREMIUM`**, подсветка |

---

## 2. Управление через CLI-скрипт (`scripts/admin.sh`)

Для удобства администратора в репозитории подготовлен исполняемый bash-скрипт [`scripts/admin.sh`](file:///Volumes/KingstonM2/Projects/avari-links/scripts/admin.sh).

Скрипт автоматически находит файл базы данных (`apps/api/data/shortener.db` или путь из переменной `AVARI_DB_PATH`) и сам рассчитывает SHA-256 хеш, если передан читаемый ключ.

### Команды скрипта

#### Общая статистика
Показывает количество сессий, распределение по тарифам и статистику по ссылкам:
```bash
./scripts/admin.sh stats
# или через make:
make admin-stats
```

#### Список сессий
Выводит интерактивную таблицу всех сессий с их тарифом, числом ссылок и датой активности:
```bash
./scripts/admin.sh list
# или через make:
make admin-list
```

#### Поиск сессии и просмотр её ссылок
В качестве аргумента можно передавать:
- Мнемонический ключ пользователя (например: `cosmic-totoro-cookie-4081`)
- UUID идентификатор сессии (например: `251d3b0f-c347-4c62-bbb8-0b7c90e18449`)
- SHA-256 хеш ключа

```bash
./scripts/admin.sh find cosmic-totoro-cookie-4081
```

Вывод:
```text
🔎 Информация о сессии:
--------------------------------------------------------
                        ID сессии = 251d3b0f-c347-4c62-bbb8-0b7c90e18449
          Тарифный статус = ★ PREMIUM (коды от 4 симв, не удаляется, ссылки 2 года)
            Хеш ключа (SHA-256) = 3956f6d6b6b0774b62e05aef080146feb61ad1510bb7e0241d7c066247e83688
Последняя активность = 2026-09-25 12:41:24.128509 +0000 UTC
              Дата создания = 2026-09-25 11:44:21.702619 +0000 UTC

🔗 Привязанные ссылки сессии:
----------------------------------------------------------------------------------------
Код (Slug)   | Клики   | Название             | Адрес назначения                   
----------------------------------------------------------------------------------------
php          | 0       | php                  | https://example.com/               
docs         | 12      | documentation        | https://github.com/project         
----------------------------------------------------------------------------------------
```

#### Выдача Premium-статуса
```bash
# По мнемоническому ключу:
./scripts/admin.sh set-premium cosmic-totoro-cookie-4081

# Или по UUID сессии:
./scripts/admin.sh set-premium 251d3b0f-c347-4c62-bbb8-0b7c90e18449
```

#### Отзыв Premium-статуса
```bash
./scripts/admin.sh revoke-premium cosmic-totoro-cookie-4081
```

---

## 3. Прямое управление через SQLite CLI (`sqlite3`)

Если запуск bash-скрипта недоступен, все операции можно выполнять стандартной утилитой `sqlite3`.

> **Путь к базе данных по умолчанию:** `apps/api/data/shortener.db`

### 3.1. Вычисление SHA-256 хеша ключа

Поскольку в БД хранится `key_hash`, для поиска сессии по ключу `cosmic-totoro-cookie-4081` необходимо получить его SHA-256:

**На macOS:**
```bash
printf "%s" "cosmic-totoro-cookie-4081" | tr '[:upper:]' '[:lower:]' | shasum -a 256 | awk '{print $1}'
```

**На Linux:**
```bash
printf "%s" "cosmic-totoro-cookie-4081" | tr '[:upper:]' '[:lower:]' | sha256sum | awk '{print $1}'
```

**Через Python:**
```bash
python3 -c "import hashlib; print(hashlib.sha256('cosmic-totoro-cookie-4081'.strip().lower().encode()).hexdigest())"
```

---

### 3.2. Полезные SQL-запросы

#### Поиск сессии по хешу ключа
```sql
SELECT id, is_premium, last_active_at, created_at
FROM anonymous_sessions
WHERE key_hash = '<ХЕШ>';
```

#### Назначение Premium-статуса
```sql
UPDATE anonymous_sessions
SET is_premium = 1, updated_at = CURRENT_TIMESTAMP
WHERE id = '<SESSION_ID>';
```

#### Снятие Premium-статуса
```sql
UPDATE anonymous_sessions
SET is_premium = 0, updated_at = CURRENT_TIMESTAMP
WHERE id = '<SESSION_ID>';
```

#### Список ссылок конкретного пользователя
```sql
SELECT id, code, clicks, is_active, original_url, created_at
FROM links
WHERE user_id = '<SESSION_ID>'
ORDER BY created_at DESC;
```

#### Просмотр кандидатов на автоочистку (неактивные > 100 дней без Premium)
```sql
SELECT id, last_active_at
FROM anonymous_sessions
WHERE is_premium = 0
  AND last_active_at < datetime('now', '-100 days');
```

---

## 4. Резервное копирование SQLite в режиме WAL

Сервис использует SQLite в режиме **Write-Ahead Logging (WAL)**. Для создания корректной горячей копии базы данных без остановки сервера используйте команду `.backup` утилиты `sqlite3`:

```bash
sqlite3 apps/api/data/shortener.db ".backup 'apps/api/data/shortener-backup-$(date +%Y%m%d_%H%M%S).db'"
```
