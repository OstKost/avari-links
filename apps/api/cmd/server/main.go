package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/OstKost/avari-links/apps/api/internal/config"
	"github.com/OstKost/avari-links/apps/api/internal/database"
	"github.com/OstKost/avari-links/apps/api/internal/handler"
	"github.com/OstKost/avari-links/apps/api/internal/repository/sqlite"
	"github.com/OstKost/avari-links/apps/api/internal/service"
	"github.com/go-playground/validator/v10"
)

// @title URL Shortener API
// @version 1.0
// @description Production-grade scalable URL Shortener REST API built with Go, Clean Architecture, and SQLite (WAL).
// @contact.name Repository Maintainer
// @contact.url https://github.com/OstKost/avari-links
// @license.name MIT
// @host localhost:4820
// @BasePath /
func main() {
	// 1. Initialize structured logging
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	slog.Info("Starting URL Shortener API service...")

	// 2. Load configuration
	cfg, err := config.Load()
	if err != nil {
		slog.Error("Failed to load configuration", "error", err)
		os.Exit(1)
	}

	// 3. Connect to Database and apply migrations
	db, err := database.NewConnection(cfg.DBPath)
	if err != nil {
		slog.Error("Failed to connect to SQLite", "path", cfg.DBPath, "error", err)
		os.Exit(1)
	}
	defer func() {
		if err := db.Close(); err != nil {
			slog.Error("Error closing database connection", "error", err)
		}
	}()

	if err := database.Migrate(db); err != nil {
		slog.Error("Failed to apply database migrations", "error", err)
		os.Exit(1)
	}

	// 4. Dependency Injection / Composition Root
	validate := validator.New()
	linkRepo := sqlite.NewLinkRepository(db)
	linkService := service.NewLinkService(linkRepo, cfg.BaseURL, cfg.CodeLength, cfg.BlockedLinkDomains)
	linkHandler := handler.NewLinkHandler(linkService, validate)
	redirectHandler := handler.NewRedirectHandler(linkService)

	router := handler.NewRouter(handler.RouterConfig{
		LinkHandler:     linkHandler,
		RedirectHandler: redirectHandler,
		DB:              db,
		AllowedOrigins:  cfg.AllowedOrigins,
	})

	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// 5. Start Server in background
	serverErrors := make(chan error, 1)
	go func() {
		slog.Info("HTTP server is listening", "port", cfg.Port, "base_url", cfg.BaseURL)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrors <- err
		}
	}()

	// 6. Graceful Shutdown listener
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErrors:
		slog.Error("Fatal server error", "error", err)
		os.Exit(1)

	case sig := <-shutdown:
		slog.Info("Shutdown signal received, initiating graceful shutdown", "signal", sig.String())

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := server.Shutdown(ctx); err != nil {
			slog.Error("Graceful shutdown failed, forcing server close", "error", err)
			_ = server.Close()
			os.Exit(1)
		}
		slog.Info("Server exited cleanly")
	}
}
