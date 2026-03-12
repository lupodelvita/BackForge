package deploy

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// ExecCommander runs real shell commands via os/exec.
type ExecCommander struct{}

func (e *ExecCommander) Run(ctx context.Context, name string, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	return cmd.CombinedOutput()
}

// LocalDeployer deploys a BackForge project as a local Docker container.
type LocalDeployer struct {
	Commander Commander
}

func NewLocalDeployer() *LocalDeployer {
	return &LocalDeployer{Commander: &ExecCommander{}}
}

// Deploy builds the Docker image and runs the container.
// buildDir must contain the generated Dockerfile and server.go.
func (d *LocalDeployer) Deploy(ctx context.Context, record *DeploymentRecord, buildDir string) error {
	imageTag := fmt.Sprintf("backforge-%s:latest", record.ProjectName)
	record.ImageTag = imageTag
	record.UpdatedAt = time.Now().UTC()

	// docker build
	out, err := d.Commander.Run(ctx, "docker", "build", "-t", imageTag, buildDir)
	if err != nil {
		record.Status = StatusFailed
		record.Error = strings.TrimSpace(string(out)) + ": " + err.Error()
		record.UpdatedAt = time.Now().UTC()
		return fmt.Errorf("docker build failed: %w\noutput: %s", err, out)
	}

	// Stop + remove any existing container with the same name
	containerName := fmt.Sprintf("backforge-%s", record.ProjectName)
	_, _ = d.Commander.Run(ctx, "docker", "rm", "-f", containerName)

	// docker run
	portMapping := fmt.Sprintf("%d:3000", record.Port)
	out, err = d.Commander.Run(ctx, "docker", "run", "-d",
		"--name", containerName,
		"-p", portMapping,
		"-e", fmt.Sprintf("BACKFORGE_PORT=3000"),
		imageTag,
	)
	if err != nil {
		record.Status = StatusFailed
		record.Error = strings.TrimSpace(string(out)) + ": " + err.Error()
		record.UpdatedAt = time.Now().UTC()
		return fmt.Errorf("docker run failed: %w\noutput: %s", err, out)
	}

	record.ContainerID = strings.TrimSpace(string(out))
	record.Status = StatusRunning
	record.URL = fmt.Sprintf("http://localhost:%d", record.Port)
	record.UpdatedAt = time.Now().UTC()
	return nil
}

// Stop stops and removes the running container.
func (d *LocalDeployer) Stop(ctx context.Context, record *DeploymentRecord) error {
	containerName := fmt.Sprintf("backforge-%s", record.ProjectName)
	out, err := d.Commander.Run(ctx, "docker", "rm", "-f", containerName)
	if err != nil {
		return fmt.Errorf("docker rm failed: %w\noutput: %s", err, out)
	}
	record.Status = StatusStopped
	record.UpdatedAt = time.Now().UTC()
	return nil
}
