package deploy

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestEdgeDeployer_Deploy_NoExportDir(t *testing.T) {
	d := &EdgeDeployer{ExportDir: ""}
	record := newRecord("my-app", 3000)

	err := d.Deploy(context.Background(), record, t.TempDir())
	if err == nil {
		t.Fatal("expected error when ExportDir is empty")
	}
	if record.Status != StatusFailed {
		t.Errorf("expected status=failed, got %s", record.Status)
	}
}

func TestEdgeDeployer_Deploy_CreatesBundleInExportDir(t *testing.T) {
	exportDir := t.TempDir()
	buildDir := t.TempDir()

	// Put a couple of files in buildDir
	os.WriteFile(filepath.Join(buildDir, "Dockerfile"), []byte("FROM alpine\n"), 0o644)
	os.WriteFile(filepath.Join(buildDir, "server.go"), []byte("package main\n"), 0o644)

	d := NewEdgeDeployer(exportDir)
	record := newRecord("edge-app", 4000)
	record.ID = "testid-123"

	err := d.Deploy(context.Background(), record, buildDir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if record.Status != StatusRunning {
		t.Errorf("expected status=running, got %s", record.Status)
	}

	expectedBundle := "edge-app-testid-123.tar.gz"
	if !strings.HasSuffix(record.URL, expectedBundle) {
		t.Errorf("expected URL to end with %s, got %s", expectedBundle, record.URL)
	}

	// Verify the bundle exists on disk
	bundlePath := filepath.Join(exportDir, expectedBundle)
	if _, err := os.Stat(bundlePath); os.IsNotExist(err) {
		t.Fatalf("expected bundle file at %s", bundlePath)
	}

	// Verify the bundle contains the expected files
	files := listTarGzFiles(t, bundlePath)
	if !containsFile(files, "Dockerfile") {
		t.Errorf("expected Dockerfile in bundle, got: %v", files)
	}
	if !containsFile(files, "server.go") {
		t.Errorf("expected server.go in bundle, got: %v", files)
	}
}

func TestEdgeDeployer_Deploy_CreatesExportDirIfAbsent(t *testing.T) {
	base := t.TempDir()
	exportDir := filepath.Join(base, "subdir", "edge-export")
	buildDir := t.TempDir()
	os.WriteFile(filepath.Join(buildDir, "Dockerfile"), []byte("FROM scratch\n"), 0o644)

	d := NewEdgeDeployer(exportDir)
	record := newRecord("proj", 5000)

	err := d.Deploy(context.Background(), record, buildDir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, err := os.Stat(exportDir); os.IsNotExist(err) {
		t.Error("ExportDir should have been created")
	}
}

func TestEdgeDeployer_Stop_RemovesBundle(t *testing.T) {
	exportDir := t.TempDir()

	// Create a dummy bundle
	record := newRecord("app", 3000)
	record.ID = "abc"
	record.Status = StatusRunning
	bundleName := "app-abc.tar.gz"
	bundlePath := filepath.Join(exportDir, bundleName)
	os.WriteFile(bundlePath, []byte("fake"), 0o644)

	d := NewEdgeDeployer(exportDir)
	err := d.Stop(context.Background(), record)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if record.Status != StatusStopped {
		t.Errorf("expected status=stopped, got %s", record.Status)
	}
	if _, err := os.Stat(bundlePath); !os.IsNotExist(err) {
		t.Errorf("expected bundle to be removed")
	}
}

func TestEdgeDeployer_Stop_AlreadyRemovedBundle_NoError(t *testing.T) {
	d := NewEdgeDeployer(t.TempDir())
	record := newRecord("gone", 0)
	record.ID = "missing"
	record.Status = StatusRunning

	err := d.Stop(context.Background(), record)
	if err != nil {
		t.Fatalf("Stop should succeed even if bundle is already gone: %v", err)
	}
	if record.Status != StatusStopped {
		t.Errorf("expected status=stopped, got %s", record.Status)
	}
}

// ── helpers ──────────────────────────────────────────────────────────────────

// listTarGzFiles returns all file names contained in a .tar.gz archive.
func listTarGzFiles(t *testing.T, path string) []string {
	t.Helper()
	f, err := os.Open(path)
	if err != nil {
		t.Fatalf("open tar.gz: %v", err)
	}
	defer f.Close()

	gr, err := gzip.NewReader(f)
	if err != nil {
		t.Fatalf("gzip reader: %v", err)
	}
	defer gr.Close()

	tr := tar.NewReader(gr)
	var names []string
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("tar next: %v", err)
		}
		names = append(names, hdr.Name)
	}
	return names
}

func containsFile(files []string, name string) bool {
	for _, f := range files {
		if f == name || strings.HasSuffix(f, "/"+name) {
			return true
		}
	}
	return false
}
