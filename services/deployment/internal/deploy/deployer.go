package deploy

import (
	"context"
	"time"
)

// DeploymentStatus represents the current state of a deployment.
const (
	StatusPending = "pending"
	StatusRunning = "running"
	StatusStopped = "stopped"
	StatusFailed  = "failed"
)

// DeploymentRecord holds all information about a single deployment.
type DeploymentRecord struct {
	ID          string    `json:"id"`
	ProjectName string    `json:"project_name"`
	Target      string    `json:"target"` // "local", "cloud", "edge"
	Status      string    `json:"status"`
	Port        int       `json:"port"`
	ContainerID string    `json:"container_id,omitempty"`
	ImageTag    string    `json:"image_tag,omitempty"`
	URL         string    `json:"url"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Error       string    `json:"error,omitempty"`
}

// Deployer is implemented by each deployment target.
type Deployer interface {
	// Deploy builds and starts the deployment. It should update record fields
	// (ContainerID, ImageTag, URL, Status) and return any error.
	Deploy(ctx context.Context, record *DeploymentRecord, buildDir string) error
	// Stop tears down a running deployment.
	Stop(ctx context.Context, record *DeploymentRecord) error
}

// Commander abstracts os/exec so deployers can be tested without Docker.
type Commander interface {
	Run(ctx context.Context, name string, args ...string) ([]byte, error)
}
