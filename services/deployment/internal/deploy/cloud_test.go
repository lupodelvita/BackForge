package deploy

import (
	"context"
	"testing"
)

func TestCloudDeployer_Deploy_NoDockerHost(t *testing.T) {
	d := &CloudDeployer{Commander: &mockCommander{}, DockerHost: ""}
	record := newRecord("my-app", 3000)

	err := d.Deploy(context.Background(), record, "/tmp/build")
	if err == nil {
		t.Fatal("expected error when DockerHost is empty")
	}
}

func TestCloudDeployer_Deploy_BuildFail(t *testing.T) {
	mock := &mockCommander{output: []byte("no such file"), err: errFake}
	d := &CloudDeployer{Commander: mock, DockerHost: "ssh://user@host"}
	record := newRecord("my-app", 3000)

	err := d.Deploy(context.Background(), record, "/tmp/build")
	if err == nil {
		t.Fatal("expected error when docker build fails")
	}
	if record.Status != StatusFailed {
		t.Errorf("expected status=failed, got %s", record.Status)
	}
}

func TestCloudDeployer_Deploy_NoRegistry_SkipsTagAndPush(t *testing.T) {
	// build + rm + run = 3 calls; no tag/push
	mock := &mockCommander{output: []byte("abc123\n")}
	d := &CloudDeployer{Commander: mock, DockerHost: "ssh://user@host", Registry: ""}
	record := newRecord("my-app", 3000)

	err := d.Deploy(context.Background(), record, "/tmp/build")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	calls := mock.calls
	hasBuild := false
	hasRemoteRun := false
	hasTag := false
	hasPush := false
	for _, c := range calls {
		if len(c) >= 2 && c[0] == "docker" && c[1] == "build" {
			hasBuild = true
		}
		if len(c) >= 3 && c[0] == "docker" && c[1] == "-H" {
			for _, arg := range c {
				if arg == "run" {
					hasRemoteRun = true
				}
			}
		}
		if len(c) >= 2 && c[0] == "docker" && c[1] == "tag" {
			hasTag = true
		}
		if len(c) >= 2 && c[0] == "docker" && c[1] == "push" {
			hasPush = true
		}
	}

	if !hasBuild {
		t.Error("expected docker build call")
	}
	if !hasRemoteRun {
		t.Error("expected docker -H ... run call")
	}
	if hasTag {
		t.Error("docker tag should not be called without a registry")
	}
	if hasPush {
		t.Error("docker push should not be called without a registry")
	}

	if record.Status != StatusRunning {
		t.Errorf("expected status=running, got %s", record.Status)
	}
	// URL should contain the host part
	if record.URL == "" {
		t.Error("expected non-empty URL")
	}
}

func TestCloudDeployer_Deploy_WithRegistry_TagsAndPushes(t *testing.T) {
	mock := &mockCommander{output: []byte("deadbeef\n")}
	d := &CloudDeployer{Commander: mock, DockerHost: "tcp://192.168.1.5:2376", Registry: "registry.example.com"}
	record := newRecord("shop", 4000)

	err := d.Deploy(context.Background(), record, "/tmp/build")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	hasTag := false
	hasPush := false
	for _, c := range mock.calls {
		if len(c) >= 2 && c[0] == "docker" && c[1] == "tag" {
			hasTag = true
		}
		if len(c) >= 2 && c[0] == "docker" && c[1] == "push" {
			hasPush = true
		}
	}
	if !hasTag {
		t.Error("expected docker tag call when registry is set")
	}
	if !hasPush {
		t.Error("expected docker push call when registry is set")
	}

	expected := "registry.example.com/backforge-shop:latest"
	if record.ImageTag != expected {
		t.Errorf("expected image tag %s, got %s", expected, record.ImageTag)
	}
}

func TestCloudDeployer_Stop_NoDockerHost(t *testing.T) {
	d := &CloudDeployer{Commander: &mockCommander{}, DockerHost: ""}
	record := newRecord("app", 3000)
	record.Status = StatusRunning

	err := d.Stop(context.Background(), record)
	if err == nil {
		t.Fatal("expected error when DockerHost is empty")
	}
}

func TestCloudDeployer_Stop_CallsRemoteRm(t *testing.T) {
	mock := &mockCommander{output: []byte("")}
	d := &CloudDeployer{Commander: mock, DockerHost: "ssh://admin@server"}
	record := newRecord("blog", 3000)
	record.Status = StatusRunning

	err := d.Stop(context.Background(), record)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if record.Status != StatusStopped {
		t.Errorf("expected status=stopped, got %s", record.Status)
	}

	found := false
	for _, c := range mock.calls {
		if len(c) >= 5 && c[0] == "docker" && c[1] == "-H" && c[3] == "rm" {
			found = true
		}
	}
	if !found {
		t.Error("expected docker -H <host> rm call")
	}
}

func TestExtractHost(t *testing.T) {
	cases := []struct{ input, want string }{
		{"ssh://ubuntu@ec2-1.compute.amazonaws.com", "ec2-1.compute.amazonaws.com"},
		{"tcp://192.168.1.5:2376", "192.168.1.5"},
		{"ssh://root@192.168.0.1", "192.168.0.1"},
	}
	for _, tc := range cases {
		got := extractHost(tc.input)
		if got != tc.want {
			t.Errorf("extractHost(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}
