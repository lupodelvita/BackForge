package deploy

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// CloudDeployer deploys a BackForge project to a remote Docker host.
//
// The remote host is specified as a Docker daemon URL, e.g.:
//   - ssh://ubuntu@ec2-1-2-3-4.compute.amazonaws.com
//   - tcp://192.168.1.100:2376
//
// If Registry is non-empty the image is tagged and pushed before running
// on the remote host, making it usable with Docker Hub or a private registry.
type CloudDeployer struct {
	Commander  Commander
	DockerHost string // e.g. "ssh://user@host" — passed to docker -H
	Registry   string // optional: "registry.example.com" prefix for the image tag
}

func NewCloudDeployer(dockerHost, registry string) *CloudDeployer {
	return &CloudDeployer{
		Commander:  &ExecCommander{},
		DockerHost: dockerHost,
		Registry:   registry,
	}
}

// Deploy builds the image locally, optionally pushes it to a registry, then
// starts the container on the configured remote Docker host.
func (c *CloudDeployer) Deploy(ctx context.Context, record *DeploymentRecord, buildDir string) error {
	if c.DockerHost == "" {
		return fmt.Errorf("CLOUD_DOCKER_HOST is not configured; set it to e.g. ssh://user@host")
	}

	localTag := fmt.Sprintf("backforge-%s:latest", record.ProjectName)
	remoteTag := localTag
	if c.Registry != "" {
		remoteTag = fmt.Sprintf("%s/backforge-%s:latest", c.Registry, record.ProjectName)
	}
	record.ImageTag = remoteTag
	record.UpdatedAt = time.Now().UTC()

	// 1. Build image locally
	out, err := c.Commander.Run(ctx, "docker", "build", "-t", localTag, buildDir)
	if err != nil {
		record.Status = StatusFailed
		record.Error = strings.TrimSpace(string(out)) + ": " + err.Error()
		record.UpdatedAt = time.Now().UTC()
		return fmt.Errorf("docker build failed: %w\noutput: %s", err, out)
	}

	// 2. Tag + push if a registry is configured
	if c.Registry != "" {
		out, err = c.Commander.Run(ctx, "docker", "tag", localTag, remoteTag)
		if err != nil {
			record.Status = StatusFailed
			record.Error = strings.TrimSpace(string(out)) + ": " + err.Error()
			record.UpdatedAt = time.Now().UTC()
			return fmt.Errorf("docker tag failed: %w\noutput: %s", err, out)
		}
		out, err = c.Commander.Run(ctx, "docker", "push", remoteTag)
		if err != nil {
			record.Status = StatusFailed
			record.Error = strings.TrimSpace(string(out)) + ": " + err.Error()
			record.UpdatedAt = time.Now().UTC()
			return fmt.Errorf("docker push failed: %w\noutput: %s", err, out)
		}
	}

	// 3. Replace any existing container on the remote host
	containerName := fmt.Sprintf("backforge-%s", record.ProjectName)
	_, _ = c.Commander.Run(ctx, "docker", "-H", c.DockerHost, "rm", "-f", containerName)

	// 4. Start container on remote
	portMapping := fmt.Sprintf("%d:3000", record.Port)
	out, err = c.Commander.Run(ctx, "docker", "-H", c.DockerHost, "run", "-d",
		"--name", containerName,
		"-p", portMapping,
		"-e", "BACKFORGE_PORT=3000",
		remoteTag,
	)
	if err != nil {
		record.Status = StatusFailed
		record.Error = strings.TrimSpace(string(out)) + ": " + err.Error()
		record.UpdatedAt = time.Now().UTC()
		return fmt.Errorf("docker run on remote failed: %w\noutput: %s", err, out)
	}

	record.ContainerID = strings.TrimSpace(string(out))
	record.Status = StatusRunning
	record.URL = fmt.Sprintf("http://%s:%d", extractHost(c.DockerHost), record.Port)
	record.UpdatedAt = time.Now().UTC()
	return nil
}

// Stop removes the running container from the remote Docker host.
func (c *CloudDeployer) Stop(ctx context.Context, record *DeploymentRecord) error {
	if c.DockerHost == "" {
		return fmt.Errorf("CLOUD_DOCKER_HOST is not configured")
	}
	containerName := fmt.Sprintf("backforge-%s", record.ProjectName)
	out, err := c.Commander.Run(ctx, "docker", "-H", c.DockerHost, "rm", "-f", containerName)
	if err != nil {
		return fmt.Errorf("docker rm on remote failed: %w\noutput: %s", err, out)
	}
	record.Status = StatusStopped
	record.UpdatedAt = time.Now().UTC()
	return nil
}

// extractHost returns the hostname/IP from a Docker daemon URL.
//
//	ssh://ubuntu@ec2-1-2-3.compute.amazonaws.com → ec2-1-2-3.compute.amazonaws.com
//	tcp://192.168.1.5:2376                        → 192.168.1.5
func extractHost(dockerHost string) string {
	s := dockerHost
	// strip scheme
	if i := strings.Index(s, "://"); i >= 0 {
		s = s[i+3:]
	}
	// strip user@
	if i := strings.LastIndex(s, "@"); i >= 0 {
		s = s[i+1:]
	}
	// strip :port
	if i := strings.LastIndex(s, ":"); i >= 0 {
		s = s[:i]
	}
	return s
}
