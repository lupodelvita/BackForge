package deploy

import (
	"context"
	"errors"
)

// EdgeDeployer is a stub for Phase 7+ edge deployment.
type EdgeDeployer struct{}

func (e *EdgeDeployer) Deploy(_ context.Context, _ *DeploymentRecord, _ string) error {
	return errors.New("edge deployment not yet implemented — planned for Phase 7")
}

func (e *EdgeDeployer) Stop(_ context.Context, _ *DeploymentRecord) error {
	return errors.New("edge deployment not yet implemented — planned for Phase 7")
}
