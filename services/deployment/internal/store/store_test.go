package store

import (
	"os"
	"testing"
	"time"

	"github.com/backforge/deployment/internal/deploy"
)

func makeRecord(id, project string) *deploy.DeploymentRecord {
	return &deploy.DeploymentRecord{
		ID:          id,
		ProjectName: project,
		Target:      "local",
		Status:      deploy.StatusPending,
		Port:        3000,
		URL:         "http://localhost:3000",
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}
}

func TestSaveAndLoad(t *testing.T) {
	dir := t.TempDir()
	s := New(dir)

	record := makeRecord("id-001", "my-app")
	if err := s.Save(record); err != nil {
		t.Fatalf("Save: %v", err)
	}

	loaded, err := s.Load("id-001")
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if loaded.ID != "id-001" {
		t.Errorf("expected id=id-001, got %s", loaded.ID)
	}
	if loaded.ProjectName != "my-app" {
		t.Errorf("expected project=my-app, got %s", loaded.ProjectName)
	}
}

func TestLoad_NotFound(t *testing.T) {
	dir := t.TempDir()
	s := New(dir)

	_, err := s.Load("non-existent-id")
	if err == nil {
		t.Fatal("expected error for missing record")
	}
}

func TestList_ReturnsAll(t *testing.T) {
	dir := t.TempDir()
	s := New(dir)

	if err := s.Save(makeRecord("a", "proj-a")); err != nil {
		t.Fatal(err)
	}
	if err := s.Save(makeRecord("b", "proj-b")); err != nil {
		t.Fatal(err)
	}

	records, err := s.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(records) != 2 {
		t.Errorf("expected 2 records, got %d", len(records))
	}
}

func TestList_EmptyDir(t *testing.T) {
	s := New(t.TempDir())
	records, err := s.List()
	if err != nil {
		t.Fatalf("List on empty dir: %v", err)
	}
	if len(records) != 0 {
		t.Errorf("expected 0 records, got %d", len(records))
	}
}

func TestList_MissingDir(t *testing.T) {
	s := New("/tmp/backforge-test-nonexistent-dir-xyz")
	records, err := s.List()
	if err != nil {
		t.Fatalf("List on missing dir should not error: %v", err)
	}
	if len(records) != 0 {
		t.Errorf("expected 0 records from missing dir, got %d", len(records))
	}
}

func TestDelete(t *testing.T) {
	dir := t.TempDir()
	s := New(dir)
	if err := s.Save(makeRecord("del-me", "x")); err != nil {
		t.Fatal(err)
	}
	if err := s.Delete("del-me"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	// File should be gone
	if _, err := os.Stat(s.path("del-me")); !os.IsNotExist(err) {
		t.Error("expected file to be deleted")
	}
}

func TestSave_UpdatesExisting(t *testing.T) {
	dir := t.TempDir()
	s := New(dir)

	r := makeRecord("upd", "myproj")
	s.Save(r)

	r.Status = deploy.StatusRunning
	s.Save(r)

	loaded, _ := s.Load("upd")
	if loaded.Status != deploy.StatusRunning {
		t.Errorf("expected status=running, got %s", loaded.Status)
	}
}
