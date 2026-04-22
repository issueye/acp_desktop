package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestGetStatus_NonRepo(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}
	status, err := GetStatus(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if status.IsRepo {
		t.Fatal("expected non-repo status")
	}
}

func TestGenerateAndCommitWorkspaceChanges(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}
	dir := t.TempDir()
	runTestGit(t, dir, "init")
	runTestGit(t, dir, "config", "user.email", "test@example.com")
	runTestGit(t, dir, "config", "user.name", "ACP Test")

	if err := os.WriteFile(filepath.Join(dir, "README.md"), []byte("# Test\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	status, err := GetStatus(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !status.IsRepo || len(status.Files) != 1 || !status.HasUntracked {
		t.Fatalf("unexpected status: %+v", status)
	}

	draft, err := GenerateCommitMessage(dir)
	if err != nil {
		t.Fatal(err)
	}
	if draft.Subject == "" || len(draft.Files) != 1 {
		t.Fatalf("unexpected draft: %+v", draft)
	}

	result, err := CommitWorkspaceChanges(dir, draft.Subject+"\n\n"+draft.Body)
	if err != nil {
		t.Fatal(err)
	}
	if result.Hash == "" || result.Subject == "" {
		t.Fatalf("unexpected commit result: %+v", result)
	}

	nextStatus, err := GetStatus(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(nextStatus.Files) != 0 {
		t.Fatalf("expected clean status after commit: %+v", nextStatus.Files)
	}
}

func TestCommitWorkspaceFiles_CommitsOnlySelectedFiles(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}
	dir := t.TempDir()
	runTestGit(t, dir, "init")
	runTestGit(t, dir, "config", "user.email", "test@example.com")
	runTestGit(t, dir, "config", "user.name", "ACP Test")

	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("a\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "b.txt"), []byte("b\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	draft, err := GenerateCommitMessageForFiles(dir, []string{"a.txt"})
	if err != nil {
		t.Fatal(err)
	}
	if len(draft.Files) != 1 || draft.Files[0].Path != "a.txt" {
		t.Fatalf("unexpected draft files: %+v", draft.Files)
	}

	result, err := CommitWorkspaceFiles(dir, draft.Subject, []string{"a.txt"})
	if err != nil {
		t.Fatal(err)
	}
	if result.Hash == "" {
		t.Fatalf("unexpected commit result: %+v", result)
	}

	status, err := GetStatus(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(status.Files) != 1 || status.Files[0].Path != "b.txt" {
		t.Fatalf("expected only b.txt to remain dirty: %+v", status.Files)
	}
}

func runTestGit(t *testing.T, cwd string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = cwd
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v failed: %s", args, string(out))
	}
}
