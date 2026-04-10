package system

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

var appVersion = "dev"

func SetVersion(version string) {
	version = strings.TrimSpace(version)
	if version == "" {
		return
	}
	appVersion = version
}

func GetVersion() string {
	return appVersion
}

func GetMachineID(appName string) (string, error) {
	cfgDir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("resolve user config dir: %w", err)
	}

	machineIDPath := filepath.Join(cfgDir, appName, "machine_id")
	if err := os.MkdirAll(filepath.Dir(machineIDPath), 0o755); err != nil {
		return "", fmt.Errorf("create machine id dir: %w", err)
	}

	if data, err := os.ReadFile(machineIDPath); err == nil {
		id := strings.TrimSpace(string(data))
		if id != "" {
			return id, nil
		}
	}

	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate machine id: %w", err)
	}
	id := hex.EncodeToString(buf)
	if err := os.WriteFile(machineIDPath, []byte(id), 0o600); err != nil {
		return "", fmt.Errorf("persist machine id: %w", err)
	}
	return id, nil
}
