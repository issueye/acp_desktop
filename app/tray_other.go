//go:build !windows

package app

func (a *App) initTray() error {
	return nil
}
