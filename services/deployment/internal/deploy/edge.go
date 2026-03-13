package deploy

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

// EdgeDeployer packages a BackForge project into a self-contained .tar.gz bundle
// and writes it to ExportDir. The bundle contains the generated Dockerfile,
// server.go, and project_state.json — everything needed to build and run the
// image on any edge node with Docker installed.
type EdgeDeployer struct {
	ExportDir string // directory where bundles are written (created if absent)
}

func NewEdgeDeployer(exportDir string) *EdgeDeployer {
	return &EdgeDeployer{ExportDir: exportDir}
}

// Deploy creates a <project>-<id>.tar.gz in ExportDir from the build context.
// After a successful export the record URL is set to the bundle path.
func (e *EdgeDeployer) Deploy(_ context.Context, record *DeploymentRecord, buildDir string) error {
	if e.ExportDir == "" {
		record.Status = StatusFailed
		record.Error = "EDGE_EXPORT_DIR is not configured"
		record.UpdatedAt = time.Now().UTC()
		return fmt.Errorf("EDGE_EXPORT_DIR is not configured")
	}
	if err := os.MkdirAll(e.ExportDir, 0o755); err != nil {
		record.Status = StatusFailed
		record.Error = err.Error()
		record.UpdatedAt = time.Now().UTC()
		return fmt.Errorf("failed to create edge export dir: %w", err)
	}

	bundleName := fmt.Sprintf("%s-%s.tar.gz", record.ProjectName, record.ID)
	bundlePath := filepath.Join(e.ExportDir, bundleName)

	if err := createTarGz(bundlePath, buildDir); err != nil {
		record.Status = StatusFailed
		record.Error = err.Error()
		record.UpdatedAt = time.Now().UTC()
		return fmt.Errorf("failed to create edge bundle: %w", err)
	}

	record.Status = StatusRunning // "running" = artifact is ready to deploy
	record.URL = "file://" + filepath.ToSlash(bundlePath)
	record.ContainerID = ""
	record.UpdatedAt = time.Now().UTC()
	return nil
}

// Stop removes the exported bundle from disk.
func (e *EdgeDeployer) Stop(_ context.Context, record *DeploymentRecord) error {
	bundleName := fmt.Sprintf("%s-%s.tar.gz", record.ProjectName, record.ID)
	bundlePath := filepath.Join(e.ExportDir, bundleName)
	if err := os.Remove(bundlePath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove edge bundle: %w", err)
	}
	record.Status = StatusStopped
	record.UpdatedAt = time.Now().UTC()
	return nil
}

// createTarGz walks srcDir and writes every file into a gzip-compressed tar
// archive at destPath.
func createTarGz(destPath, srcDir string) error {
	f, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer f.Close()

	gw := gzip.NewWriter(f)
	defer gw.Close()
	tw := tar.NewWriter(gw)
	defer tw.Close()

	return filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}
		hdr, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		hdr.Name = filepath.ToSlash(rel)
		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}
		if !info.IsDir() {
			src, err := os.Open(path)
			if err != nil {
				return err
			}
			defer src.Close()
			_, err = io.Copy(tw, src)
			return err
		}
		return nil
	})
}
