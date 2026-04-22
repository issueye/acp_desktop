package git

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

type FileStatus struct {
	Path   string `json:"path"`
	Status string `json:"status"`
}

type Status struct {
	IsRepo          bool         `json:"isRepo"`
	Branch          string       `json:"branch"`
	Ahead           int          `json:"ahead"`
	Behind          int          `json:"behind"`
	Files           []FileStatus `json:"files"`
	HasStaged       bool         `json:"hasStaged"`
	HasUnstaged     bool         `json:"hasUnstaged"`
	HasUntracked    bool         `json:"hasUntracked"`
	MergeInProgress bool         `json:"mergeInProgress"`
}

type CommitMessageDraft struct {
	Subject string       `json:"subject"`
	Body    string       `json:"body"`
	Files   []FileStatus `json:"files"`
}

type CommitResult struct {
	Hash    string `json:"hash"`
	Subject string `json:"subject"`
}

func GetStatus(cwd string) (Status, error) {
	dir, err := normalizeCwd(cwd)
	if err != nil {
		return Status{}, err
	}
	if err := ensureGitAvailable(); err != nil {
		return Status{}, err
	}
	if _, err := runGit(dir, "rev-parse", "--is-inside-work-tree"); err != nil {
		return Status{IsRepo: false}, nil
	}

	out, err := runGit(dir, "status", "--short", "--branch")
	if err != nil {
		return Status{}, err
	}

	status := Status{IsRepo: true}
	lines := strings.Split(strings.ReplaceAll(out, "\r\n", "\n"), "\n")
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		if strings.HasPrefix(line, "## ") {
			parseBranchLine(&status, strings.TrimPrefix(line, "## "))
			continue
		}
		file := parseStatusLine(line)
		if file.Path == "" {
			continue
		}
		status.Files = append(status.Files, file)
		if strings.HasPrefix(file.Status, "??") {
			status.HasUntracked = true
			continue
		}
		if len(file.Status) > 0 && file.Status[0] != ' ' && file.Status[0] != '?' {
			status.HasStaged = true
		}
		if len(file.Status) > 1 && file.Status[1] != ' ' {
			status.HasUnstaged = true
		}
	}

	status.MergeInProgress = mergeInProgress(dir)
	return status, nil
}

func GenerateCommitMessage(cwd string) (CommitMessageDraft, error) {
	status, err := GetStatus(cwd)
	if err != nil {
		return CommitMessageDraft{}, err
	}
	return generateCommitMessageFromStatus(status, nil)
}

func GenerateCommitMessageForFiles(cwd string, paths []string) (CommitMessageDraft, error) {
	status, err := GetStatus(cwd)
	if err != nil {
		return CommitMessageDraft{}, err
	}
	return generateCommitMessageFromStatus(status, paths)
}

func generateCommitMessageFromStatus(status Status, paths []string) (CommitMessageDraft, error) {
	if !status.IsRepo {
		return CommitMessageDraft{}, errors.New("current workspace is not a git repository")
	}
	files, err := filterStatusFiles(status.Files, paths)
	if err != nil {
		return CommitMessageDraft{}, err
	}
	if len(files) == 0 {
		return CommitMessageDraft{Subject: "", Body: "", Files: files}, nil
	}

	prefix := inferCommitPrefix(files)
	scope := inferCommitScope(files)
	subject := fmt.Sprintf("%s: update %s", prefix, scope)
	bodyLines := make([]string, 0, len(files))
	for _, file := range files {
		bodyLines = append(bodyLines, fmt.Sprintf("- %s %s", strings.TrimSpace(file.Status), file.Path))
	}

	return CommitMessageDraft{
		Subject: subject,
		Body:    strings.Join(bodyLines, "\n"),
		Files:   files,
	}, nil
}

func CommitWorkspaceChanges(cwd, message string) (CommitResult, error) {
	return commitWorkspaceFiles(cwd, message, nil)
}

func CommitWorkspaceFiles(cwd, message string, paths []string) (CommitResult, error) {
	return commitWorkspaceFiles(cwd, message, paths)
}

func commitWorkspaceFiles(cwd, message string, paths []string) (CommitResult, error) {
	dir, err := normalizeCwd(cwd)
	if err != nil {
		return CommitResult{}, err
	}
	status, err := GetStatus(dir)
	if err != nil {
		return CommitResult{}, err
	}
	if !status.IsRepo {
		return CommitResult{}, errors.New("current workspace is not a git repository")
	}
	if status.MergeInProgress {
		return CommitResult{}, errors.New("merge or rebase is in progress; resolve it before committing")
	}
	files, err := filterStatusFiles(status.Files, paths)
	if err != nil {
		return CommitResult{}, err
	}
	if len(files) == 0 {
		return CommitResult{}, errors.New("there are no workspace changes to commit")
	}

	subject, body := splitCommitMessage(message)
	if subject == "" {
		return CommitResult{}, errors.New("commit message subject is required")
	}

	if len(paths) == 0 {
		if _, err := runGit(dir, "add", "-A"); err != nil {
			return CommitResult{}, err
		}
	} else {
		args := append([]string{"add", "--"}, paths...)
		if _, err := runGit(dir, args...); err != nil {
			return CommitResult{}, err
		}
	}
	args := []string{"commit", "-m", subject}
	if body != "" {
		args = append(args, "-m", body)
	}
	if _, err := runGit(dir, args...); err != nil {
		return CommitResult{}, err
	}

	hash, err := runGit(dir, "rev-parse", "HEAD")
	if err != nil {
		return CommitResult{}, err
	}
	committedSubject, err := runGit(dir, "log", "-1", "--pretty=%s")
	if err != nil {
		committedSubject = subject
	}
	return CommitResult{
		Hash:    strings.TrimSpace(hash),
		Subject: strings.TrimSpace(committedSubject),
	}, nil
}

func filterStatusFiles(files []FileStatus, paths []string) ([]FileStatus, error) {
	if len(paths) == 0 {
		return files, nil
	}
	wanted := make(map[string]struct{}, len(paths))
	for _, path := range paths {
		normalized := normalizeGitPath(path)
		if normalized == "" {
			continue
		}
		wanted[normalized] = struct{}{}
	}
	if len(wanted) == 0 {
		return nil, errors.New("select at least one file to commit")
	}

	seen := map[string]struct{}{}
	selected := make([]FileStatus, 0, len(wanted))
	for _, file := range files {
		normalized := normalizeGitPath(file.Path)
		if _, ok := wanted[normalized]; !ok {
			continue
		}
		selected = append(selected, file)
		seen[normalized] = struct{}{}
	}
	for path := range wanted {
		if _, ok := seen[path]; !ok {
			return nil, fmt.Errorf("selected file is not in git status: %s", path)
		}
	}
	return selected, nil
}

func normalizeGitPath(path string) string {
	return strings.Trim(strings.ReplaceAll(strings.TrimSpace(path), "\\", "/"), "/")
}

func normalizeCwd(cwd string) (string, error) {
	dir := strings.TrimSpace(cwd)
	if dir == "" {
		dir = "."
	}
	abs, err := filepath.Abs(dir)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return "", fmt.Errorf("workspace path is not a directory: %s", abs)
	}
	return abs, nil
}

func ensureGitAvailable() error {
	if _, err := exec.LookPath("git"); err != nil {
		return errors.New("git executable was not found in PATH")
	}
	return nil
}

func runGit(cwd string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = cwd
	out, err := cmd.CombinedOutput()
	if err != nil {
		text := strings.TrimSpace(string(out))
		if text == "" {
			text = err.Error()
		}
		return "", fmt.Errorf("git %s: %s", strings.Join(args, " "), text)
	}
	return string(out), nil
}

func parseBranchLine(status *Status, line string) {
	name := line
	if before, _, ok := strings.Cut(line, "..."); ok {
		name = before
	}
	if before, _, ok := strings.Cut(name, " "); ok {
		name = before
	}
	status.Branch = strings.TrimSpace(name)
	if status.Branch == "" {
		status.Branch = "HEAD"
	}
	if start := strings.Index(line, "["); start >= 0 {
		end := strings.Index(line[start:], "]")
		if end > 0 {
			meta := line[start+1 : start+end]
			for _, part := range strings.Split(meta, ",") {
				part = strings.TrimSpace(part)
				if strings.HasPrefix(part, "ahead ") {
					status.Ahead, _ = strconv.Atoi(strings.TrimPrefix(part, "ahead "))
				}
				if strings.HasPrefix(part, "behind ") {
					status.Behind, _ = strconv.Atoi(strings.TrimPrefix(part, "behind "))
				}
			}
		}
	}
}

func parseStatusLine(line string) FileStatus {
	if len(line) < 3 {
		return FileStatus{}
	}
	status := line[:2]
	path := strings.TrimSpace(line[3:])
	if before, after, ok := strings.Cut(path, " -> "); ok {
		path = strings.TrimSpace(after)
		if path == "" {
			path = strings.TrimSpace(before)
		}
	}
	return FileStatus{Path: path, Status: status}
}

func mergeInProgress(cwd string) bool {
	gitDir, err := runGit(cwd, "rev-parse", "--git-dir")
	if err != nil {
		return false
	}
	gitDir = strings.TrimSpace(gitDir)
	if !filepath.IsAbs(gitDir) {
		gitDir = filepath.Join(cwd, gitDir)
	}
	markers := []string{"MERGE_HEAD", "REBASE_HEAD", "rebase-merge", "rebase-apply"}
	for _, marker := range markers {
		if _, err := os.Stat(filepath.Join(gitDir, marker)); err == nil {
			return true
		}
	}
	return false
}

func inferCommitPrefix(files []FileStatus) string {
	hasDocs := false
	hasCode := false
	hasConfig := false
	for _, file := range files {
		path := strings.ToLower(file.Path)
		switch {
		case strings.HasPrefix(path, "docs/") || strings.HasSuffix(path, ".md"):
			hasDocs = true
		case strings.HasPrefix(path, ".github/") || strings.HasSuffix(path, ".json") || strings.HasSuffix(path, ".yml") || strings.HasSuffix(path, ".yaml"):
			hasConfig = true
		default:
			hasCode = true
		}
	}
	if hasCode {
		return "feat"
	}
	if hasDocs {
		return "docs"
	}
	if hasConfig {
		return "chore"
	}
	return "chore"
}

func inferCommitScope(files []FileStatus) string {
	hasFrontend := false
	hasBackend := false
	hasDocs := false
	for _, file := range files {
		path := strings.ToLower(file.Path)
		if strings.HasPrefix(path, "frontend/") {
			hasFrontend = true
		}
		if strings.HasPrefix(path, "internal/") || strings.HasPrefix(path, "app/") || strings.HasSuffix(path, ".go") {
			hasBackend = true
		}
		if strings.HasPrefix(path, "docs/") || strings.HasSuffix(path, ".md") {
			hasDocs = true
		}
	}
	switch {
	case hasFrontend && hasBackend:
		return "desktop workflow"
	case hasFrontend:
		return "frontend workspace UI"
	case hasBackend:
		return "backend services"
	case hasDocs:
		return "documentation"
	default:
		return "workspace changes"
	}
}

func splitCommitMessage(message string) (string, string) {
	lines := strings.Split(strings.ReplaceAll(message, "\r\n", "\n"), "\n")
	subject := ""
	bodyLines := []string{}
	for _, line := range lines {
		if subject == "" {
			if strings.TrimSpace(line) == "" {
				continue
			}
			subject = strings.TrimSpace(line)
			continue
		}
		bodyLines = append(bodyLines, line)
	}
	return subject, strings.TrimSpace(strings.Join(bodyLines, "\n"))
}
