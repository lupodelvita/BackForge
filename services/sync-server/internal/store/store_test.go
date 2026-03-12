package store_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/backforge/sync-server/internal/store"
)

func makeSnap(project, id string) *store.Snapshot {
	clock, _ := json.Marshal(map[string]uint64{"node-a": 1})
	return &store.Snapshot{
		ID:          id,
		ProjectName: project,
		NodeID:      "node-a",
		Clock:       clock,
		SHA256:      "abc123",
		Content:     []byte(`{"meta":{"name":"` + project + `"}}`),
		CreatedAt:   time.Now().UTC(),
	}
}

func TestPutAndGetLatest(t *testing.T) {
	dir := t.TempDir()
	s, err := store.New(dir)
	if err != nil {
		t.Fatal(err)
	}

	snap := makeSnap("blog", "snap-1")
	if err := s.Put(snap); err != nil {
		t.Fatalf("Put: %v", err)
	}

	got, err := s.GetLatest("blog")
	if err != nil {
		t.Fatalf("GetLatest: %v", err)
	}
	if got.ID != "snap-1" {
		t.Errorf("expected id=snap-1, got %s", got.ID)
	}
}

func TestGetLatestNotFound(t *testing.T) {
	dir := t.TempDir()
	s, _ := store.New(dir)
	_, err := s.GetLatest("ghost")
	if err != store.ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestHistoryOrdering(t *testing.T) {
	dir := t.TempDir()
	s, _ := store.New(dir)

	for i, id := range []string{"snap-a", "snap-b", "snap-c"} {
		snap := makeSnap("proj", id)
		snap.CreatedAt = time.Now().Add(time.Duration(i) * time.Second)
		_ = s.Put(snap)
	}

	metas, err := s.History("proj")
	if err != nil {
		t.Fatal(err)
	}
	if len(metas) != 3 {
		t.Fatalf("expected 3 metas, got %d", len(metas))
	}
	for i := 1; i < len(metas); i++ {
		if !metas[i-1].CreatedAt.Before(metas[i].CreatedAt) {
			t.Error("history not sorted ascending by CreatedAt")
		}
	}
}

func TestHistoryNotFound(t *testing.T) {
	dir := t.TempDir()
	s, _ := store.New(dir)
	_, err := s.History("ghost")
	if err != store.ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestDeleteProject(t *testing.T) {
	dir := t.TempDir()
	s, _ := store.New(dir)
	_ = s.Put(makeSnap("todelete", "s1"))

	if err := s.Delete("todelete"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	_, err := s.GetLatest("todelete")
	if err != store.ErrNotFound {
		t.Errorf("expected ErrNotFound after delete, got %v", err)
	}
}

func TestDeleteNotFound(t *testing.T) {
	dir := t.TempDir()
	s, _ := store.New(dir)
	if err := s.Delete("ghost"); err != store.ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestPutOverwritesLatest(t *testing.T) {
	dir := t.TempDir()
	s, _ := store.New(dir)

	snap1 := makeSnap("proj", "v1")
	snap2 := makeSnap("proj", "v2")
	_ = s.Put(snap1)
	_ = s.Put(snap2)

	got, _ := s.GetLatest("proj")
	if got.ID != "v2" {
		t.Errorf("expected latest=v2, got %s", got.ID)
	}
}
