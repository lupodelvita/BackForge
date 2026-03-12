package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/backforge/deployment/internal/deploy"
)

// Store persists DeploymentRecords as individual JSON files.
type Store struct {
	dir string
}

func New(dir string) *Store {
	return &Store{dir: dir}
}

func (s *Store) ensureDir() error {
	return os.MkdirAll(s.dir, 0755)
}

func (s *Store) path(id string) string {
	return filepath.Join(s.dir, id+".json")
}

// Save writes or overwrites the deployment record to disk.
func (s *Store) Save(record *deploy.DeploymentRecord) error {
	if err := s.ensureDir(); err != nil {
		return fmt.Errorf("create deployments dir: %w", err)
	}
	data, err := json.MarshalIndent(record, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal record: %w", err)
	}
	return os.WriteFile(s.path(record.ID), data, 0644)
}

// Load reads a deployment record by ID.
func (s *Store) Load(id string) (*deploy.DeploymentRecord, error) {
	data, err := os.ReadFile(s.path(id))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("deployment %q not found", id)
		}
		return nil, err
	}
	var record deploy.DeploymentRecord
	if err := json.Unmarshal(data, &record); err != nil {
		return nil, fmt.Errorf("unmarshal record: %w", err)
	}
	return &record, nil
}

// List returns all deployment records.
func (s *Store) List() ([]*deploy.DeploymentRecord, error) {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []*deploy.DeploymentRecord{}, nil
		}
		return nil, err
	}
	var records []*deploy.DeploymentRecord
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		id := e.Name()[:len(e.Name())-5] // strip .json
		r, err := s.Load(id)
		if err != nil {
			continue // skip corrupted records
		}
		records = append(records, r)
	}
	return records, nil
}

// Delete removes a deployment record.
func (s *Store) Delete(id string) error {
	err := os.Remove(s.path(id))
	if os.IsNotExist(err) {
		return fmt.Errorf("deployment %q not found", id)
	}
	return err
}
