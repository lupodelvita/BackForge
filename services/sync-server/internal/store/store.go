package store

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"
)

// Snapshot represents a versioned project_state snapshot stored server-side.
type Snapshot struct {
	ID          string          `json:"id"`
	ProjectName string          `json:"project_name"`
	NodeID      string          `json:"node_id"`
	Clock       json.RawMessage `json:"clock"`   // opaque VectorClock JSON
	SHA256      string          `json:"sha256"`
	Content     []byte          `json:"content"` // raw project_state.json bytes
	CreatedAt   time.Time       `json:"created_at"`
}

// SnapshotMeta is the Snapshot without the heavy Content field.
type SnapshotMeta struct {
	ID          string          `json:"id"`
	ProjectName string          `json:"project_name"`
	NodeID      string          `json:"node_id"`
	Clock       json.RawMessage `json:"clock"`
	SHA256      string          `json:"sha256"`
	CreatedAt   time.Time       `json:"created_at"`
}

// ErrNotFound is returned when a project has no snapshots.
var ErrNotFound = errors.New("snapshot not found")

// Store is a filesystem-backed snapshot store.
// Layout: <root>/<project>/<snapshot-id>.json
//          <root>/<project>/latest.json  (symlink or copy of latest)
type Store struct {
	root string
}

func New(root string) (*Store, error) {
	if err := os.MkdirAll(root, 0755); err != nil {
		return nil, err
	}
	return &Store{root: root}, nil
}

func (s *Store) projectDir(project string) string {
	return filepath.Join(s.root, project)
}

// Put stores a snapshot. Overwrites latest.json for the project.
func (s *Store) Put(snap *Snapshot) error {
	dir := s.projectDir(snap.ProjectName)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	data, err := json.Marshal(snap)
	if err != nil {
		return err
	}
	// Write versioned copy
	versionedPath := filepath.Join(dir, snap.ID+".json")
	if err := os.WriteFile(versionedPath, data, 0644); err != nil {
		return err
	}
	// Write / overwrite latest
	latestPath := filepath.Join(dir, "latest.json")
	return os.WriteFile(latestPath, data, 0644)
}

// GetLatest returns the latest snapshot for a project.
func (s *Store) GetLatest(project string) (*Snapshot, error) {
	latestPath := filepath.Join(s.projectDir(project), "latest.json")
	data, err := os.ReadFile(latestPath)
	if errors.Is(err, os.ErrNotExist) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	var snap Snapshot
	if err := json.Unmarshal(data, &snap); err != nil {
		return nil, err
	}
	return &snap, nil
}

// History returns metadata for all versioned snapshots for a project, sorted by CreatedAt asc.
func (s *Store) History(project string) ([]SnapshotMeta, error) {
	dir := s.projectDir(project)
	entries, err := os.ReadDir(dir)
	if errors.Is(err, os.ErrNotExist) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	var metas []SnapshotMeta
	for _, e := range entries {
		if e.IsDir() || e.Name() == "latest.json" {
			continue
		}
		if filepath.Ext(e.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			return nil, fmt.Errorf("reading %s: %w", e.Name(), err)
		}
		var snap Snapshot
		if err := json.Unmarshal(data, &snap); err != nil {
			return nil, err
		}
		metas = append(metas, SnapshotMeta{
			ID:          snap.ID,
			ProjectName: snap.ProjectName,
			NodeID:      snap.NodeID,
			Clock:       snap.Clock,
			SHA256:      snap.SHA256,
			CreatedAt:   snap.CreatedAt,
		})
	}
	sort.Slice(metas, func(i, j int) bool {
		return metas[i].CreatedAt.Before(metas[j].CreatedAt)
	})
	return metas, nil
}

// Delete removes all snapshots for a project.
func (s *Store) Delete(project string) error {
	dir := s.projectDir(project)
	if _, err := os.Stat(dir); errors.Is(err, os.ErrNotExist) {
		return ErrNotFound
	}
	return os.RemoveAll(dir)
}
