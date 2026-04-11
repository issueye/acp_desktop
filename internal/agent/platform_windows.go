//go:build windows

package agent

import (
	"os/exec"
	"syscall"

	"golang.org/x/sys/windows"
)

func isWindows() bool {
	return true
}

func applyPlatformCmdAttrs(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: windows.CREATE_NO_WINDOW,
	}
}
