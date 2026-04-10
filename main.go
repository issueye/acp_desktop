package main

import (
	"embed"
	"log"

	appcore "acp_go_ui/app"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:dist
var assets embed.FS

var version = "dev"

func main() {
	app, err := appcore.New("acp-ui", version)
	if err != nil {
		log.Fatalf("failed to initialize app: %v", err)
	}

	err = wails.Run(&options.App{
		Title:       "ACP UI",
		Width:       1200,
		Height:      800,
		AssetServer: &assetserver.Options{Assets: assets},
		OnStartup:   app.Startup,
		OnShutdown:  app.Shutdown,
		Bind: []interface{}{
			app,
		},
	})
	if err != nil {
		log.Fatalf("failed to run app: %v", err)
	}
}
