package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
)

const storageBinary = "backforge"

// storageRoot is the shared filesystem root used by the Rust storage engine.
// In Docker this is /workspace/storage; fall back to $HOME/.backforge/storage.
func storageRoot() string {
	if root := os.Getenv("BACKFORGE_STORAGE_ROOT"); root != "" {
		return root
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".backforge", "storage")
}

// ---- Bucket handlers -------------------------------------------------------

// PUT /storage/{project}/{bucket}
func StorageCreateBucket(w http.ResponseWriter, r *http.Request) {
	project := chi.URLParam(r, "project")
	bucket := chi.URLParam(r, "bucket")

	cmd := exec.CommandContext(r.Context(), storageBinary, "storage", "bucket-create", project, bucket)
	if out, err := cmd.CombinedOutput(); err != nil {
		errorJSON(w, http.StatusInternalServerError, strings.TrimSpace(string(out)))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "created",
		"project": project,
		"bucket":  bucket,
	})
}

// DELETE /storage/{project}/{bucket}
func StorageDeleteBucket(w http.ResponseWriter, r *http.Request) {
	project := chi.URLParam(r, "project")
	bucket := chi.URLParam(r, "bucket")

	cmd := exec.CommandContext(r.Context(), storageBinary, "storage", "bucket-delete", project, bucket)
	if out, err := cmd.CombinedOutput(); err != nil {
		errorJSON(w, http.StatusInternalServerError, strings.TrimSpace(string(out)))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GET /storage/{project}
func StorageListBuckets(w http.ResponseWriter, r *http.Request) {
	project := chi.URLParam(r, "project")

	// Read bucket dirs directly from filesystem (faster than spawning a process)
	projectDir := filepath.Join(storageRoot(), project)
	entries, err := os.ReadDir(projectDir)
	if err != nil {
		if os.IsNotExist(err) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"project": project,
				"buckets": []string{},
			})
			return
		}
		errorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}

	buckets := []string{}
	for _, e := range entries {
		if e.IsDir() {
			buckets = append(buckets, e.Name())
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"project": project,
		"buckets": buckets,
	})
}

// ---- Object handlers -------------------------------------------------------

// PUT /storage/{project}/{bucket}/{key}
// Accepts raw body as object data; Content-Type header stored as metadata.
func StorageUpload(w http.ResponseWriter, r *http.Request) {
	project := chi.URLParam(r, "project")
	bucket := chi.URLParam(r, "bucket")
	key := chi.URLParam(r, "key")

	// Write uploaded bytes to a temp file
	tmp, err := os.CreateTemp("", "backforge-upload-*")
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, "failed to create temp file")
		return
	}
	defer os.Remove(tmp.Name())
	defer tmp.Close()

	if _, err := io.Copy(tmp, r.Body); err != nil {
		errorJSON(w, http.StatusBadRequest, "failed to read request body")
		return
	}
	tmp.Close()

	args := []string{"storage", "upload", project, bucket, key, tmp.Name()}
	if ct := r.Header.Get("Content-Type"); ct != "" && ct != "application/octet-stream" {
		args = append(args, "--content-type", ct)
	}
	cmd := exec.CommandContext(r.Context(), storageBinary, args...)
	if out, err := cmd.CombinedOutput(); err != nil {
		errorJSON(w, http.StatusInternalServerError, strings.TrimSpace(string(out)))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "uploaded",
		"project": project,
		"bucket":  bucket,
		"key":     key,
	})
}

// GET /storage/{project}/{bucket}/{key}
// Streams object bytes directly from the filesystem.
func StorageDownload(w http.ResponseWriter, r *http.Request) {
	project := chi.URLParam(r, "project")
	bucket := chi.URLParam(r, "bucket")
	key := chi.URLParam(r, "key")

	// Derive object file path using the same FNV hash the Rust engine uses.
	filename := fnvFilename(key)
	objectPath := filepath.Join(storageRoot(), project, bucket, "objects", filename)
	metaPath := filepath.Join(storageRoot(), project, bucket, "meta", filename+".json")

	// Read content-type from metadata if available
	contentType := "application/octet-stream"
	if metaBytes, err := os.ReadFile(metaPath); err == nil {
		var meta map[string]interface{}
		if json.Unmarshal(metaBytes, &meta) == nil {
			if ct, ok := meta["content_type"].(string); ok && ct != "" {
				contentType = ct
			}
		}
	}

	f, err := os.Open(objectPath)
	if err != nil {
		if os.IsNotExist(err) {
			errorJSON(w, http.StatusNotFound, "object not found")
		} else {
			errorJSON(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	defer f.Close()

	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(http.StatusOK)
	io.Copy(w, f) //nolint:errcheck
}

// DELETE /storage/{project}/{bucket}/{key}
func StorageDeleteObject(w http.ResponseWriter, r *http.Request) {
	project := chi.URLParam(r, "project")
	bucket := chi.URLParam(r, "bucket")
	key := chi.URLParam(r, "key")

	cmd := exec.CommandContext(r.Context(), storageBinary, "storage", "delete", project, bucket, key)
	if out, err := cmd.CombinedOutput(); err != nil {
		errorJSON(w, http.StatusInternalServerError, strings.TrimSpace(string(out)))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /storage/{project}/{bucket}
func StorageListObjects(w http.ResponseWriter, r *http.Request) {
	project := chi.URLParam(r, "project")
	bucket := chi.URLParam(r, "bucket")

	metaDir := filepath.Join(storageRoot(), project, bucket, "meta")
	entries, err := os.ReadDir(metaDir)
	if err != nil {
		if os.IsNotExist(err) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"project": project, "bucket": bucket, "objects": []string{},
			})
			return
		}
		errorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}

	objects := []map[string]interface{}{}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(metaDir, e.Name()))
		if err != nil {
			continue
		}
		var meta map[string]interface{}
		if json.Unmarshal(raw, &meta) == nil {
			objects = append(objects, meta)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"project": project,
		"bucket":  bucket,
		"objects": objects,
	})
}

// fnvFilename replicates the Rust md5_simple() FNV-like filename derivation.
// Must match the algorithm in crates/backforge-storage/src/object.rs.
func fnvFilename(key string) string {
	const (
		fnvOffset uint64 = 0xcbf29ce484222325
		fnvPrime  uint64 = 0x100000001b3
	)
	h := fnvOffset
	for _, b := range []byte(key) {
		h ^= uint64(b)
		h *= fnvPrime
	}
	// Rust formats with {:x} — no leading zeros, lowercase hex
	return fmt.Sprintf("%x", h)
}

func formatHex16(n uint64) string {
	const hexChars = "0123456789abcdef"
	buf := make([]byte, 16)
	for i := 15; i >= 0; i-- {
		buf[i] = hexChars[n&0xf]
		n >>= 4
	}
	return string(buf)
}
