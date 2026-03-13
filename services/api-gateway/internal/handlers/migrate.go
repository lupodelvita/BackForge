package handlers

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// MigrateStatus handles GET /migrate/{name}/status
func MigrateStatus(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if pool == nil {
			errorJSON(w, http.StatusServiceUnavailable, "database not connected — set DATABASE_URL")
			return
		}
		name := chi.URLParam(r, "name")
		migsDir := filepath.Join(projectsRoot(), name, "migrations")

		files, err := readSQLFiles(migsDir)
		if err != nil {
			writeJSON(w, http.StatusOK, map[string]any{
				"project": name, "applied": []string{}, "pending": []string{},
			})
			return
		}

		applied, err := getAppliedMigrations(r.Context(), pool)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "query migrations: "+err.Error())
			return
		}
		appliedSet := make(map[string]bool, len(applied))
		for _, f := range applied {
			appliedSet[f] = true
		}

		var pending []string
		for _, f := range files {
			if !appliedSet[f] {
				pending = append(pending, f)
			}
		}
		if pending == nil {
			pending = []string{}
		}
		if applied == nil {
			applied = []string{}
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"project": name,
			"applied": applied,
			"pending": pending,
		})
	}
}

// MigrateRun handles POST /migrate/{name}/run
// Applies every .sql file in the project's migrations/ directory that has not
// yet been recorded in _backforge_migrations.
func MigrateRun(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if pool == nil {
			errorJSON(w, http.StatusServiceUnavailable, "database not connected — set DATABASE_URL")
			return
		}
		name := chi.URLParam(r, "name")
		migsDir := filepath.Join(projectsRoot(), name, "migrations")

		files, err := readSQLFiles(migsDir)
		if err != nil {
			writeJSON(w, http.StatusOK, map[string]any{
				"project": name, "applied_count": 0, "migrations": []string{},
				"message": "no migrations directory found",
			})
			return
		}

		ctx := r.Context()
		if err := initMigrationsTable(ctx, pool); err != nil {
			errorJSON(w, http.StatusInternalServerError, "init migrations table: "+err.Error())
			return
		}

		applied, err := getAppliedMigrations(ctx, pool)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, "query migrations: "+err.Error())
			return
		}
		appliedSet := make(map[string]bool, len(applied))
		for _, f := range applied {
			appliedSet[f] = true
		}

		var ran []string
		for _, filename := range files {
			if appliedSet[filename] {
				continue
			}

			sql, err := os.ReadFile(filepath.Join(migsDir, filename))
			if err != nil {
				errorJSON(w, http.StatusInternalServerError, "read "+filename+": "+err.Error())
				return
			}

			tx, err := pool.Begin(ctx)
			if err != nil {
				errorJSON(w, http.StatusInternalServerError, "begin tx: "+err.Error())
				return
			}

			if _, err := tx.Exec(ctx, string(sql)); err != nil {
				_ = tx.Rollback(ctx)
				errorJSON(w, http.StatusInternalServerError, filename+": "+err.Error())
				return
			}

			if _, err := tx.Exec(ctx,
				`INSERT INTO _backforge_migrations (filename) VALUES ($1)`, filename); err != nil {
				_ = tx.Rollback(ctx)
				errorJSON(w, http.StatusInternalServerError, "record migration: "+err.Error())
				return
			}

			if err := tx.Commit(ctx); err != nil {
				errorJSON(w, http.StatusInternalServerError, "commit: "+err.Error())
				return
			}
			ran = append(ran, filename)
		}

		if ran == nil {
			ran = []string{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"project":       name,
			"applied_count": len(ran),
			"migrations":    ran,
		})
	}
}

// ── helpers ───────────────────────────────────────────────────────────────────

func readSQLFiles(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)
	return files, nil
}

func initMigrationsTable(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS _backforge_migrations (
			id          SERIAL PRIMARY KEY,
			filename    TEXT NOT NULL UNIQUE,
			applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`)
	return err
}

func getAppliedMigrations(ctx context.Context, pool *pgxpool.Pool) ([]string, error) {
	rows, err := pool.Query(ctx,
		`SELECT filename FROM _backforge_migrations ORDER BY applied_at`)
	if err != nil {
		// Table may not exist yet
		return []string{}, nil //nolint:nilerr
	}
	defer rows.Close()

	var result []string
	for rows.Next() {
		var f string
		if err := rows.Scan(&f); err != nil {
			return nil, err
		}
		result = append(result, f)
	}
	return result, rows.Err()
}
