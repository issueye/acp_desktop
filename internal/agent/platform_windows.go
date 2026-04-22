//go:build windows

package agent

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"sync"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

type platformProcess struct {
	job  windows.Handle
	once sync.Once
}

func isWindows() bool {
	return true
}

func applyPlatformCmdAttrs(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: windows.CREATE_NO_WINDOW | windows.CREATE_SUSPENDED,
	}
}

func resumeProcess(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}

	hSnapshot, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPTHREAD, 0)
	if err != nil {
		return fmt.Errorf("create thread snapshot: %w", err)
	}
	defer windows.CloseHandle(hSnapshot)

	entry := windows.ThreadEntry32{Size: 28}
	resumed := false
	for {
		if err := windows.Thread32Next(hSnapshot, &entry); err != nil {
			break
		}
		if entry.OwnerProcessID == uint32(cmd.Process.Pid) {
			hThread, err := windows.OpenThread(windows.THREAD_SUSPEND_RESUME, false, entry.ThreadID)
			if err != nil {
				continue
			}
			_, _ = windows.ResumeThread(hThread)
			windows.CloseHandle(hThread)
			resumed = true
		}
	}

	if !resumed {
		return fmt.Errorf("no threads found for process %d", cmd.Process.Pid)
	}
	return nil
}

func preparePlatformProcess(_ *exec.Cmd) (*platformProcess, error) {
	job, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		return nil, err
	}

	limits := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{}
	limits.BasicLimitInformation.LimitFlags = windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
	_, err = windows.SetInformationJobObject(
		job,
		windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&limits)),
		uint32(unsafe.Sizeof(limits)),
	)
	if err != nil {
		_ = windows.CloseHandle(job)
		return nil, err
	}

	return &platformProcess{job: job}, nil
}

func bindPlatformProcess(process *platformProcess, cmd *exec.Cmd) error {
	if process == nil || process.job == 0 || cmd == nil || cmd.Process == nil {
		return nil
	}

	handle, err := windows.OpenProcess(windows.PROCESS_SET_QUOTA|windows.PROCESS_TERMINATE, false, uint32(cmd.Process.Pid))
	if err != nil {
		return err
	}
	defer windows.CloseHandle(handle)

	err = windows.AssignProcessToJobObject(process.job, handle)
	if err != nil {
		if errors.Is(err, windows.ERROR_ACCESS_DENIED) {
			return nil
		}
		return err
	}
	return nil
}

func terminateProcessTree(process *platformProcess, cmd *exec.Cmd) error {
	if process != nil && process.job != 0 {
		if err := windows.TerminateJobObject(process.job, 1); err == nil {
			return nil
		}
	}

	return fallbackKillProcessTree(cmd)
}

func fallbackKillProcessTree(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}

	killCmd := exec.Command("taskkill.exe", "/T", "/F", "/PID", strconv.Itoa(cmd.Process.Pid))
	killCmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: windows.CREATE_NO_WINDOW}
	if err := killCmd.Run(); err == nil {
		return nil
	}

	if err := cmd.Process.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) {
		return fmt.Errorf("kill process: %w", err)
	}
	return nil
}

func releasePlatformProcess(process *platformProcess) {
	if process == nil || process.job == 0 {
		return
	}
	process.once.Do(func() {
		_ = windows.CloseHandle(process.job)
		process.job = 0
	})
}
