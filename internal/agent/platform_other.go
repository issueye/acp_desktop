//go:build !windows

package agent

import "os/exec"

func isWindows() bool {
	return false
}

func applyPlatformCmdAttrs(_ *exec.Cmd) {}
