//go:build !windows

package agent

import (
	"errors"
	"os"
	"os/exec"
	"syscall"
	"time"
)

type platformProcess struct {
	pgid int
}

func isWindows() bool {
	return false
}

func applyPlatformCmdAttrs(_ *exec.Cmd) {}

func preparePlatformProcess(cmd *exec.Cmd) (*platformProcess, error) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	return &platformProcess{}, nil
}

func bindPlatformProcess(process *platformProcess, cmd *exec.Cmd) error {
	if process == nil || cmd == nil || cmd.Process == nil {
		return nil
	}

	pgid, err := syscall.Getpgid(cmd.Process.Pid)
	if err != nil {
		process.pgid = cmd.Process.Pid
		return nil
	}
	process.pgid = pgid
	return nil
}

func terminateProcessTree(process *platformProcess, cmd *exec.Cmd) error {
	if process != nil && process.pgid > 0 {
		if err := syscall.Kill(-process.pgid, syscall.SIGTERM); err != nil && !errors.Is(err, syscall.ESRCH) {
			return fallbackKillProcess(cmd)
		}

		time.Sleep(500 * time.Millisecond)
		if err := syscall.Kill(-process.pgid, syscall.SIGKILL); err != nil && !errors.Is(err, syscall.ESRCH) {
			return fallbackKillProcess(cmd)
		}
		return nil
	}

	return fallbackKillProcess(cmd)
}

func fallbackKillProcess(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	if err := cmd.Process.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) {
		return err
	}
	return nil
}

func releasePlatformProcess(_ *platformProcess) {}

func resumeProcess(cmd *exec.Cmd) error {
	return nil
}
