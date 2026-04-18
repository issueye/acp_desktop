//go:build windows

package app

import (
	"fmt"
	"os"
	"runtime"
	"sync"
	"syscall"
	"unsafe"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/sys/windows"
)

const (
	trayIconID         = 1001
	trayCallbackMsg    = 0x8001
	trayMenuShowID     = 2001
	trayMenuHideID     = 2002
	trayMenuQuitID     = 2003
	nimAdd             = 0x00000000
	nimDelete          = 0x00000002
	nifMessage         = 0x00000001
	nifIcon            = 0x00000002
	nifTip             = 0x00000004
	mfString           = 0x00000000
	mfSeparator        = 0x00000800
	tpmLeftAlign       = 0x0000
	tpmBottomAlign     = 0x0020
	tpmRightButton     = 0x0002
	wmCommand          = 0x0111
	wmDestroy          = 0x0002
	wmClose            = 0x0010
	wmNull             = 0x0000
	wmLButtonUp        = 0x0202
	wmRButtonUp        = 0x0205
	wmContextMenu      = 0x007B
	idiApplication     = 32512
)

var (
	user32              = windows.NewLazySystemDLL("user32.dll")
	shell32             = windows.NewLazySystemDLL("shell32.dll")
	kernel32            = windows.NewLazySystemDLL("kernel32.dll")
	procRegisterClassEx = user32.NewProc("RegisterClassExW")
	procCreateWindowEx  = user32.NewProc("CreateWindowExW")
	procDefWindowProc   = user32.NewProc("DefWindowProcW")
	procDestroyWindow   = user32.NewProc("DestroyWindow")
	procPostQuitMessage = user32.NewProc("PostQuitMessage")
	procGetMessage      = user32.NewProc("GetMessageW")
	procTranslateMsg    = user32.NewProc("TranslateMessage")
	procDispatchMessage = user32.NewProc("DispatchMessageW")
	procCreatePopupMenu = user32.NewProc("CreatePopupMenu")
	procAppendMenu      = user32.NewProc("AppendMenuW")
	procTrackPopupMenu  = user32.NewProc("TrackPopupMenu")
	procSetForeground   = user32.NewProc("SetForegroundWindow")
	procGetCursorPos    = user32.NewProc("GetCursorPos")
	procPostMessage     = user32.NewProc("PostMessageW")
	procDestroyMenu     = user32.NewProc("DestroyMenu")
	procLoadIcon        = user32.NewProc("LoadIconW")
	procDestroyIcon     = user32.NewProc("DestroyIcon")
	procUnregisterClass = user32.NewProc("UnregisterClassW")
	procShellNotifyIcon = shell32.NewProc("Shell_NotifyIconW")
	procExtractIconEx   = shell32.NewProc("ExtractIconExW")
	procGetModuleHandle = kernel32.NewProc("GetModuleHandleW")
)

type windowsTray struct {
	app          *App
	className    *uint16
	windowName   *uint16
	hwnd         windows.Handle
	menu         windows.Handle
	icon         windows.Handle
	destroyIcon  bool
	wndProc      uintptr
	ready        chan error
	done         chan struct{}
	stopOnce     sync.Once
	cleanupOnce  sync.Once
}

type point struct {
	X int32
	Y int32
}

type msg struct {
	HWnd    windows.Handle
	Message uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	Pt      point
	LPrivate uint32
}

type wndClassEx struct {
	CbSize        uint32
	Style         uint32
	LpfnWndProc   uintptr
	CbClsExtra    int32
	CbWndExtra    int32
	HInstance     windows.Handle
	HIcon         windows.Handle
	HCursor       windows.Handle
	HbrBackground windows.Handle
	LpszMenuName  *uint16
	LpszClassName *uint16
	HIconSm       windows.Handle
}

type notifyIconData struct {
	CbSize           uint32
	HWnd             windows.Handle
	UID              uint32
	UFlags           uint32
	UCallbackMessage uint32
	HIcon            windows.Handle
	SzTip            [128]uint16
	DwState          uint32
	DwStateMask      uint32
	SzInfo           [256]uint16
	UTimeoutOrVersion uint32
	SzInfoTitle      [64]uint16
	DwInfoFlags      uint32
	GuidItem         windows.GUID
	HBalloonIcon     windows.Handle
}

func (a *App) initTray() error {
	tray, err := newWindowsTray(a)
	if err != nil {
		return err
	}
	a.tray = tray
	return nil
}

func newWindowsTray(app *App) (*windowsTray, error) {
	tray := &windowsTray{
		app:   app,
		ready: make(chan error, 1),
		done:  make(chan struct{}),
	}

	go tray.run()

	if err := <-tray.ready; err != nil {
		return nil, err
	}
	return tray, nil
}

func (t *windowsTray) run() {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	defer close(t.done)
	defer t.cleanup()

	if err := t.createTrayWindow(); err != nil {
		t.ready <- err
		return
	}

	if err := t.createTrayMenu(); err != nil {
		t.ready <- err
		return
	}

	if err := t.addTrayIcon(); err != nil {
		t.ready <- err
		return
	}

	t.ready <- nil

	var message msg
	for {
		result, _, _ := procGetMessage.Call(uintptr(unsafe.Pointer(&message)), 0, 0, 0)
		switch int32(result) {
		case -1:
			return
		case 0:
			return
		default:
			procTranslateMsg.Call(uintptr(unsafe.Pointer(&message)))
			procDispatchMessage.Call(uintptr(unsafe.Pointer(&message)))
		}
	}
}

func (t *windowsTray) createTrayWindow() error {
	instance, _, err := procGetModuleHandle.Call(0)
	if instance == 0 {
		return fmt.Errorf("tray get module handle failed: %w", err)
	}

	className, err := windows.UTF16PtrFromString("ACPDesktopTrayWindow")
	if err != nil {
		return err
	}
	windowName, err := windows.UTF16PtrFromString("ACP Desktop Tray")
	if err != nil {
		return err
	}

	t.className = className
	t.windowName = windowName
	t.wndProc = syscall.NewCallback(t.handleWindowMessage)

	windowClass := wndClassEx{
		CbSize:        uint32(unsafe.Sizeof(wndClassEx{})),
		LpfnWndProc:   t.wndProc,
		HInstance:     windows.Handle(instance),
		LpszClassName: className,
	}

	classAtom, _, registerErr := procRegisterClassEx.Call(uintptr(unsafe.Pointer(&windowClass)))
	if classAtom == 0 {
		return fmt.Errorf("tray register window class failed: %w", registerErr)
	}

	hwnd, _, createErr := procCreateWindowEx.Call(
		0,
		uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(windowName)),
		0,
		0, 0, 0, 0,
		0,
		0,
		instance,
		0,
	)
	if hwnd == 0 {
		return fmt.Errorf("tray create window failed: %w", createErr)
	}

	t.hwnd = windows.Handle(hwnd)
	return nil
}

func (t *windowsTray) createTrayMenu() error {
	menuHandle, _, err := procCreatePopupMenu.Call()
	if menuHandle == 0 {
		return fmt.Errorf("tray create popup menu failed: %w", err)
	}
	t.menu = windows.Handle(menuHandle)

	if err := appendMenuString(t.menu, trayMenuShowID, "Show ACP Desktop"); err != nil {
		return err
	}
	if err := appendMenuString(t.menu, trayMenuHideID, "Hide Window"); err != nil {
		return err
	}
	if _, _, err := procAppendMenu.Call(uintptr(t.menu), mfSeparator, 0, 0); err != nil && err != windows.ERROR_SUCCESS {
		return fmt.Errorf("tray append separator failed: %w", err)
	}
	if err := appendMenuString(t.menu, trayMenuQuitID, "Quit ACP Desktop"); err != nil {
		return err
	}
	return nil
}

func appendMenuString(menu windows.Handle, id uintptr, label string) error {
	labelPtr, err := windows.UTF16PtrFromString(label)
	if err != nil {
		return err
	}
	result, _, callErr := procAppendMenu.Call(uintptr(menu), mfString, id, uintptr(unsafe.Pointer(labelPtr)))
	if result == 0 {
		return fmt.Errorf("append menu item failed: %w", callErr)
	}
	return nil
}

func (t *windowsTray) addTrayIcon() error {
	icon, destroyIcon, err := loadTrayIcon()
	if err != nil {
		return err
	}
	t.icon = icon
	t.destroyIcon = destroyIcon

	data := notifyIconData{
		CbSize:           uint32(unsafe.Sizeof(notifyIconData{})),
		HWnd:             t.hwnd,
		UID:              trayIconID,
		UFlags:           nifMessage | nifIcon | nifTip,
		UCallbackMessage: trayCallbackMsg,
		HIcon:            t.icon,
	}
	tooltip, tooltipErr := windows.UTF16FromString("ACP DESKTOP")
	if tooltipErr != nil {
		return tooltipErr
	}
	copy(data.SzTip[:], tooltip)

	result, _, callErr := procShellNotifyIcon.Call(nimAdd, uintptr(unsafe.Pointer(&data)))
	if result == 0 {
		return fmt.Errorf("tray add icon failed: %w", callErr)
	}
	return nil
}

func loadTrayIcon() (windows.Handle, bool, error) {
	executable, err := os.Executable()
	if err == nil {
		exePtr, convErr := windows.UTF16PtrFromString(executable)
		if convErr == nil {
			var largeIcon windows.Handle
			var smallIcon windows.Handle
			result, _, _ := procExtractIconEx.Call(
				uintptr(unsafe.Pointer(exePtr)),
				0,
				uintptr(unsafe.Pointer(&largeIcon)),
				uintptr(unsafe.Pointer(&smallIcon)),
				1,
			)
			if result > 0 {
				if smallIcon != 0 {
					return smallIcon, true, nil
				}
				if largeIcon != 0 {
					return largeIcon, true, nil
				}
			}
		}
	}

	result, _, loadErr := procLoadIcon.Call(0, idiApplication)
	if result == 0 {
		return 0, false, fmt.Errorf("tray load fallback icon failed: %w", loadErr)
	}

	return windows.Handle(result), false, nil
}

func (t *windowsTray) handleWindowMessage(hwnd uintptr, msg uint32, wParam uintptr, lParam uintptr) uintptr {
	switch msg {
	case trayCallbackMsg:
		switch uint32(lParam) {
		case wmLButtonUp:
			go t.app.showMainWindow()
			return 0
		case wmRButtonUp, wmContextMenu:
			t.showContextMenu()
			return 0
		}
	case wmCommand:
		switch lowWord(wParam) {
		case trayMenuShowID:
			go t.app.showMainWindow()
			return 0
		case trayMenuHideID:
			go t.app.hideMainWindow()
			return 0
		case trayMenuQuitID:
			go t.app.quitApplication()
			return 0
		}
	case wmClose:
		procDestroyWindow.Call(hwnd)
		return 0
	case wmDestroy:
		procPostQuitMessage.Call(0)
		return 0
	}

	result, _, _ := procDefWindowProc.Call(hwnd, uintptr(msg), wParam, lParam)
	return result
}

func (t *windowsTray) showContextMenu() {
	if t.menu == 0 || t.hwnd == 0 {
		return
	}

	var cursor point
	procGetCursorPos.Call(uintptr(unsafe.Pointer(&cursor)))
	procSetForeground.Call(uintptr(t.hwnd))
	procTrackPopupMenu.Call(
		uintptr(t.menu),
		tpmLeftAlign|tpmBottomAlign|tpmRightButton,
		uintptr(cursor.X),
		uintptr(cursor.Y),
		0,
		uintptr(t.hwnd),
		0,
	)
	procPostMessage.Call(uintptr(t.hwnd), wmNull, 0, 0)
}

func (t *windowsTray) Close() {
	t.stopOnce.Do(func() {
		if t.hwnd != 0 {
			procPostMessage.Call(uintptr(t.hwnd), wmClose, 0, 0)
		}
		<-t.done
	})
}

func (t *windowsTray) cleanup() {
	t.cleanupOnce.Do(func() {
		if t.hwnd != 0 {
			data := notifyIconData{
				CbSize: uint32(unsafe.Sizeof(notifyIconData{})),
				HWnd:   t.hwnd,
				UID:    trayIconID,
			}
			procShellNotifyIcon.Call(nimDelete, uintptr(unsafe.Pointer(&data)))
			t.hwnd = 0
		}

		if t.menu != 0 {
			procDestroyMenu.Call(uintptr(t.menu))
			t.menu = 0
		}

		if t.icon != 0 && t.destroyIcon {
			procDestroyIcon.Call(uintptr(t.icon))
			t.icon = 0
		}

		if t.className != nil {
			procUnregisterClass.Call(uintptr(unsafe.Pointer(t.className)), 0)
			t.className = nil
		}
	})
}

func lowWord(value uintptr) uintptr {
	return value & 0xffff
}

func (a *App) showMainWindow() {
	if a.ctx == nil {
		return
	}
	wruntime.WindowUnminimise(a.ctx)
	wruntime.WindowShow(a.ctx)
	wruntime.Show(a.ctx)
}

func (a *App) hideMainWindow() {
	if a.ctx == nil {
		return
	}
	wruntime.WindowHide(a.ctx)
	wruntime.Hide(a.ctx)
}

func (a *App) quitApplication() {
	if a.ctx == nil {
		return
	}
	wruntime.Quit(a.ctx)
}
