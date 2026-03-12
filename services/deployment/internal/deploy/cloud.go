package deploy

import (
	"context"
	"errors"
)

// CloudDeployer is a stub for Phase 7+ cloud deployment.
type CloudDeployer struct{}

func (c *CloudDeployer) Deploy(_ context.Context, _ *DeploymentRecord, _ string) error {
	return errors.New("cloud deployment not yet implemented — planned for Phase 7")
}

func (c *CloudDeployer) Stop(_ context.Context, _ *DeploymentRecord) error {
	return errors.New("cloud deployment not yet implemented — planned for Phase 7")
}
