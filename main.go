package main

import (
	"embed"
	"log"

	appcore "acp_go_ui/app"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

var version = "dev"

func main() {
	app, err := appcore.New("acp-ui", version)
	if err != nil {
		log.Fatalf("failed to initialize app: %v", err)
	}

	err = wails.Run(&options.App{
		Title:                    "ACP DESKTOP",
		Width:                    1280,
		Height:                   860,
		MinWidth:                 1080,
		MinHeight:                720,
		Frameless:                true,
		HideWindowOnClose:        true,
		BackgroundColour:         options.NewRGB(8, 12, 18),
		AssetServer:              &assetserver.Options{Assets: assets},
		OnStartup:                app.Startup,
		OnShutdown:               app.Shutdown,
		EnableDefaultContextMenu: true,
		Windows: &windows.Options{
			Theme:                             windows.SystemDefault,
			DisableFramelessWindowDecorations: false,
		},
		Bind: []interface{}{
			app,
		},
	})
	if err != nil {
		log.Fatalf("failed to run app: %v", err)
	}
}
