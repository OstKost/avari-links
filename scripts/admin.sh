#!/usr/bin/env bash
# ==============================================================================
# Avari Links - Administration & Premium Management CLI
# ==============================================================================
set -euo pipefail

# 1. Locate Database
find_db() {
  if [ -n "${AVARI_DB_PATH:-}" ] && [ -f "$AVARI_DB_PATH" ]; then
    echo "$AVARI_DB_PATH"
    return
  fi

  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local root_dir
  root_dir="$(cd "$script_dir/.." && pwd)"

  local candidates=(
    "$root_dir/apps/api/data/shortener.db"
    "$root_dir/apps/api/data/avari.db"
    "./apps/api/data/shortener.db"
    "./data/shortener.db"
    "./shortener.db"
  )

  for candidate in "${candidates[@]}"; do
    if [ -f "$candidate" ]; then
      echo "$candidate"
      return
    fi
  done

  echo ""
}

DB_FILE="$(find_db)"

if [ -z "$DB_FILE" ] || [ ! -f "$DB_FILE" ]; then
  echo "❌ Ошибка: Файл базы данных не найден." >&2
  echo "Укажите путь через переменную окружения AVARI_DB_PATH, например:" >&2
  echo "  export AVARI_DB_PATH=apps/api/data/shortener.db" >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "❌ Ошибка: Утилита sqlite3 не установлена в системе." >&2
  exit 1
fi

# 2. SHA-256 Key Hasher
hash_key() {
  local input="$1"
  local clean
  clean="$(printf "%s" "$input" | tr '[:upper:]' '[:lower:]' | xargs)"
  if command -v sha256sum >/dev/null 2>&1; then
    printf "%s" "$clean" | sha256sum | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    printf "%s" "$clean" | shasum -a 256 | awk '{print $1}'
  else
    python3 -c "import hashlib, sys; print(hashlib.sha256(sys.argv[1].encode('utf-8')).hexdigest())" "$clean"
  fi
}

# Resolve session ID from either:
# - raw session ID (UUID format)
# - key hash (64 hex chars)
# - mnemonic access key phrase (e.g. cosmic-totoro-cookie-4081)
resolve_session_id() {
  local target="$1"
  local found_id

  # Check if target is directly an ID
  found_id="$(sqlite3 "$DB_FILE" "SELECT id FROM anonymous_sessions WHERE id = '$target' LIMIT 1;")"
  if [ -n "$found_id" ]; then
    echo "$found_id"
    return
  fi

  # Check if target is already a SHA-256 hash
  found_id="$(sqlite3 "$DB_FILE" "SELECT id FROM anonymous_sessions WHERE key_hash = '$target' LIMIT 1;")"
  if [ -n "$found_id" ]; then
    echo "$found_id"
    return
  fi

  # Treat target as mnemonic key and hash it
  local kh
  kh="$(hash_key "$target")"
  found_id="$(sqlite3 "$DB_FILE" "SELECT id FROM anonymous_sessions WHERE key_hash = '$kh' LIMIT 1;")"
  if [ -n "$found_id" ]; then
    echo "$found_id"
    return
  fi

  echo ""
}

# 3. Commands
cmd_help() {
  cat << 'EOF'
Avari Links - Скрипт управления пользователями и тарифами

Использование:
  ./scripts/admin.sh [команда] [аргументы]

Команды:
  list                          Показать список всех сессий и их статус
  stats                         Показать общую статистику (сессии, тарифы, ссылки)
  find <KEY_OR_ID>              Найти сессию по ключу, ID или хешу и показать её ссылки
  set-premium <KEY_OR_ID>       Выдать сессии Premium-статус
  revoke-premium <KEY_OR_ID>    Снять с сессии Premium-статус
  help                          Показать эту справку

Параметры <KEY_OR_ID>:
  Можно передавать:
  - Мнемонический ключ (например: cosmic-totoro-cookie-4081)
  - ID сессии (UUID, например: 251d3b0f-c347-4c62-bbb8-0b7c90e18449)
  - SHA-256 хеш ключа

Переменные окружения:
  AVARI_DB_PATH                 Путь к файлу базы данных SQLite (по умолчанию apps/api/data/shortener.db)

EOF
}

cmd_stats() {
  echo "📊 Статистика сервиса Avari Links"
  echo "База данных: $DB_FILE"
  echo "--------------------------------------------------------"
  sqlite3 "$DB_FILE" << 'EOF'
.mode line
SELECT
  COUNT(*) AS "Всего сессий",
  SUM(CASE WHEN is_premium = 1 THEN 1 ELSE 0 END) AS "Premium сессий",
  SUM(CASE WHEN is_premium = 0 THEN 1 ELSE 0 END) AS "Standard сессий"
FROM anonymous_sessions;

SELECT
  COUNT(*) AS "Всего ссылок",
  SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS "Активных ссылок",
  COALESCE(SUM(clicks), 0) AS "Суммарно переходов"
FROM links;
EOF
}

cmd_list() {
  echo "📋 Список анонимных сессий (База данных: $DB_FILE)"
  echo "------------------------------------------------------------------------------------------------------"
  printf "%-38s | %-12s | %-7s | %-20s\n" "ID сессии" "Тариф" "Ссылки" "Последняя активность"
  echo "------------------------------------------------------------------------------------------------------"
  sqlite3 -separator '|' "$DB_FILE" \
    "SELECT s.id, CASE WHEN s.is_premium = 1 THEN '★ PREMIUM' ELSE 'Standard' END, COUNT(l.id), s.last_active_at FROM anonymous_sessions s LEFT JOIN links l ON l.user_id = s.id GROUP BY s.id ORDER BY s.is_premium DESC, s.last_active_at DESC;" | \
    while IFS='|' read -r sid tier links last_active; do
      printf "%-38s | %-12s | %-7s | %-20s\n" "$sid" "$tier" "$links" "$last_active"
    done
  echo "------------------------------------------------------------------------------------------------------"
}

cmd_find() {
  local target="${1:-}"
  if [ -z "$target" ]; then
    echo "❌ Ошибка: Укажите мнемонический ключ, UUID сессии или SHA-256 хеш." >&2
    exit 1
  fi

  local sid
  sid="$(resolve_session_id "$target")"
  if [ -z "$sid" ]; then
    echo "⚠️  Сессия по запросу '$target' не найдена в базе."
    exit 1
  fi

  echo "🔎 Информация о сессии:"
  echo "--------------------------------------------------------"
  sqlite3 "$DB_FILE" << EOF
.mode line
SELECT
  id AS "ID сессии",
  CASE WHEN is_premium = 1 THEN '★ PREMIUM (коды от 4 симв, не удаляется, ссылки 2 года)' ELSE 'Standard (коды от 8 симв, автоочистка 100 дней)' END AS "Тарифный статус",
  key_hash AS "Хеш ключа (SHA-256)",
  last_active_at AS "Последняя активность",
  created_at AS "Дата создания"
FROM anonymous_sessions
WHERE id = '$sid';
EOF

  echo ""
  echo "🔗 Привязанные ссылки сессии:"
  echo "----------------------------------------------------------------------------------------"
  printf "%-12s | %-7s | %-20s | %-35s\n" "Код (Slug)" "Клики" "Название" "Адрес назначения"
  echo "----------------------------------------------------------------------------------------"
  sqlite3 -separator '|' "$DB_FILE" \
    "SELECT code, clicks, coalesce(title, '-'), original_url FROM links WHERE user_id = '$sid' ORDER BY created_at DESC;" | \
    while IFS='|' read -r code clicks title url; do
      printf "%-12s | %-7s | %-20.20s | %-35.35s\n" "$code" "$clicks" "$title" "$url"
    done
  echo "----------------------------------------------------------------------------------------"
}

cmd_set_premium() {
  local target="${1:-}"
  if [ -z "$target" ]; then
    echo "❌ Ошибка: Укажите мнемонический ключ, UUID сессии или SHA-256 хеш." >&2
    exit 1
  fi

  local sid
  sid="$(resolve_session_id "$target")"
  if [ -z "$sid" ]; then
    echo "⚠️  Сессия по запросу '$target' не найдена в базе."
    exit 1
  fi

  sqlite3 "$DB_FILE" "UPDATE anonymous_sessions SET is_premium = 1 WHERE id = '$sid';"
  echo "✅ Сессии $sid успешно присвоен статус ★ PREMIUM!"
  echo "   - Пользователь теперь может создавать короткие ссылки от 4 символов"
  echo "   - Профиль защищён от автоматической очистки"
  echo "   - Ссылки сохраняются минимум 2 года при отсутствии активности"
}

cmd_revoke_premium() {
  local target="${1:-}"
  if [ -z "$target" ]; then
    echo "❌ Ошибка: Укажите мнемонический ключ, UUID сессии или SHA-256 хеш." >&2
    exit 1
  fi

  local sid
  sid="$(resolve_session_id "$target")"
  if [ -z "$sid" ]; then
    echo "⚠️  Сессия по запросу '$target' не найдена в базе."
    exit 1
  fi

  sqlite3 "$DB_FILE" "UPDATE anonymous_sessions SET is_premium = 0 WHERE id = '$sid';"
  echo "ℹ️  Premium-статус для сессии $sid отключён (переведена на Standard)."
}

# 4. Dispatcher
COMMAND="${1:-help}"
case "$COMMAND" in
  list)
    cmd_list
    ;;
  stats)
    cmd_stats
    ;;
  find)
    shift
    cmd_find "${1:-}"
    ;;
  set-premium|upgrade)
    shift
    cmd_set_premium "${1:-}"
    ;;
  revoke-premium|downgrade)
    shift
    cmd_revoke_premium "${1:-}"
    ;;
  help|--help|-h)
    cmd_help
    ;;
  *)
    echo "Неизвестная команда: $COMMAND" >&2
    cmd_help
    exit 1
    ;;
esac
