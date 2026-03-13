package deploy

import (
	"context"
	"testing"
	"time"
)

// mockCommander records calls for testing.
type mockCommander struct {
	calls  [][]string
	output []byte
	err    error
}

func (m *mockCommander) Run(_ context.Context, name string, args ...string) ([]byte, error) {
	call := append([]string{name}, args...)
	m.calls = append(m.calls, call)
	return m.output, m.err
}

func newRecord(project string, port int) *DeploymentRecord {
	return &DeploymentRecord{
		ID:          "test-id",
		ProjectName: project,
		Target:      "local",
		Status:      StatusPending,
		Port:        port,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}
}

func TestLocalDeployer_Deploy_CallsDockerBuildAndRun(t *testing.T) {
	mock := &mockCommander{output: []byte("abc123\n")}
	d := &LocalDeployer{Commander: mock}
	record := newRecord("my-app", 3000)

	err := d.Deploy(context.Background(), record, "/tmp/build")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(mock.calls) < 2 {
		t.Fatalf("expected at least 2 docker calls, got %d", len(mock.calls))
	}

	// First call: docker build
	if mock.calls[0][0] != "docker" || mock.calls[0][1] != "build" {
		t.Errorf("expected 'docker build', got %v", mock.calls[0])
	}
	// Last call: docker run
	lastCall := mock.calls[len(mock.calls)-1]
	if lastCall[0] != "docker" || lastCall[1] != "run" {
		t.Errorf("expected 'docker run', got %v", lastCall)
	}

	if record.Status != StatusRunning {
		t.Errorf("expected status=%s, got %s", StatusRunning, record.Status)
	}
	if record.URL != "http://localhost:3000" {
		t.Errorf("expected URL=http://localhost:3000, got %s", record.URL)
	}
	if record.ImageTag != "backforge-my-app:latest" {
		t.Errorf("expected image tag, got %s", record.ImageTag)
	}
}

func TestLocalDeployer_Deploy_BuildFail(t *testing.T) {
	mock := &mockCommander{output: []byte("error: no such file"), err: errFake}
	d := &LocalDeployer{Commander: mock}
	record := newRecord("bad-project", 3001)

	err := d.Deploy(context.Background(), record, "/tmp/build")
	if err == nil {
		t.Fatal("expected error on build fail")
	}
	if record.Status != StatusFailed {
		t.Errorf("expected status=failed, got %s", record.Status)
	}
}

func TestLocalDeployer_Stop(t *testing.T) {
	mock := &mockCommander{output: []byte("")}
	d := &LocalDeployer{Commander: mock}
	record := newRecord("my-app", 3000)
	record.Status = StatusRunning

	err := d.Stop(context.Background(), record)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if record.Status != StatusStopped {
		t.Errorf("expected status=stopped, got %s", record.Status)
	}
	// Verify docker rm -f was called
	found := false
	for _, call := range mock.calls {
		if len(call) >= 3 && call[0] == "docker" && call[1] == "rm" {
			found = true
		}
	}
	if !found {
		t.Error("expected 'docker rm' call")
	}
}

// errFake is a simple sentinel error for tests.
var errFake = makeErr("fake error")

type fakeErr string

func (e fakeErr) Error() string { return string(e) }
func makeErr(s string) error     { return fakeErr(s) }
