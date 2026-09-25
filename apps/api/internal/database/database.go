package database

import (
	"database/sql"
	"embed"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/pressly/goose/v3"
	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var embedMigrations embed.FS

// NewConnection opens and configures a SQLite connection with production-grade pragmas.
func NewConnection(dbPath string) (*sql.DB, error) {
	// Ensure directory exists
	dir := filepath.Dir(dbPath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create database directory: %w", err)
		}
	}

	// SQLite connection string with pragmas:
	// _journal_mode=WAL: Enables Write-Ahead Logging for concurrent reads and writes
	// _busy_timeout=5000: Wait up to 5s if database is locked
	// _foreign_keys=on: Enforce foreign key constraints
	// _synchronous=NORMAL: Balanced durability and high write speed in WAL mode
	dsn := fmt.Sprintf("%s?_journal_mode=WAL&_busy_timeout=5000&_foreign_keys=on&_synchronous=NORMAL", dbPath)

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	// For SQLite, 1 open write connection is best to avoid busy lock contention in single-process mode,
	// while WAL mode allows unlimited concurrent readers.
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping sqlite database: %w", err)
	}

	return db, nil
}

// Migrate runs embedded database migrations using goose.
func Migrate(db *sql.DB) error {
	goose.SetBaseFS(embedMigrations)

	if err := goose.SetDialect("sqlite3"); err != nil {
		return fmt.Errorf("failed to set goose dialect: %w", err)
	}

	slog.Info("Running database migrations...")
	if err := goose.Up(db, "migrations"); err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}
	slog.Info("Database migrations completed successfully")

	return nil
}
