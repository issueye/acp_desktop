# ACP DESKTOP

<p align="center">
  <img src="./assets/logo.png" alt="ACP DESKTOP" width="96" />
</p>

ACP DESKTOP is a Wails-based desktop client for ACP-compatible agents. It combines a Go backend with a Vue 3 frontend to provide session management, multi-agent switching, chat interaction, tool rendering, plan tracking, local file access, and desktop-native capabilities such as tray integration.

[中文](./README.md)

## Screenshots

### Home

The home screen provides a clear starting point for creating a new session, reviewing saved sessions, and checking the current Agent and working directory state.

![Home](./assets/screenshots/home.png)

### Create Session

The create-session dialog centralizes Agent selection, working directory selection, and network proxy configuration. A summary panel on the right helps confirm the connection details before starting.

![Create Session](./assets/screenshots/add_session.png)

### Agent Settings

The settings view supports managing the Agent list, including command, arguments, environment variable count, edit actions, and delete actions. It is designed for maintaining multiple ACP Agent launch configurations.

![Agent Settings](./assets/screenshots/setting_agent_list.png)

### Chat

The chat view includes the session title, Agent information, model and mode selectors, session refresh, command hints, and a bottom input box for ongoing coding analysis, edits, and Q&A.

![Chat](./assets/screenshots/chat.png)

### Permission Confirmation

When an Agent needs to execute sensitive tools or access local resources, the app shows a permission confirmation dialog with the tool name, target path, and available actions so you can approve the operation before it runs.

![Permission Confirmation](./assets/screenshots/permission.png)

### Tasks And Tool Calls

The task panel displays the current plan on the right side of the chat window, while tool calls are rendered as a concise status list so you can follow the Agent's analysis, file reads, command execution, and summaries.

![Tasks And Tool Calls](./assets/screenshots/tasks.png)

## Tech Stack

- Backend: Go 1.22+ / Wails v2
- Frontend: Vue 3, Vite, Pinia
- Desktop shell: Wails frameless window
- Protocol SDK: `@agentclientprotocol/sdk`

## Main Features

- Agent management: maintain multiple ACP Agents with editable commands, arguments, and environment variables.
- Session management: create, resume, refresh, and disconnect sessions, with saved sessions shown in the left sidebar.
- Chat interaction: supports normal messages, command hints, model selection, and mode selection.
- Tool rendering: displays tool names, paths, statuses, and expandable long content.
- Permission confirmation: shows a confirmation dialog before sensitive tool execution, including tool information and target paths.
- Task planning: shows the current plan in the right-side task panel, with panel collapse and long-task folding.
- Working directory: choose a working directory when creating a session and keep it associated with the session.
- Network proxy: configure HTTP, HTTPS, ALL_PROXY, and NO_PROXY when creating a session.
- Local files: supports local text file reads and writes through the desktop bridge.
- Local persistence: stores user preferences, session metadata, and configuration files.
- Desktop capabilities: supports frameless windows, background hiding, and Windows tray menus.

## Workflow

1. Start the app, then select or add an Agent from the home screen.
2. Click "Create Session" and confirm the Agent, working directory, and proxy configuration.
3. After the session starts, enter the chat view and type a prompt or use `/` to view available commands.
4. During execution, review tool calls, thinking state, and the current task plan on the right.
5. Disconnect when finished, then resume the session later from the saved sessions list.

## Project Structure

```text
.
|- app/                Wails app entrypoints and platform tray integration
|- assets/             App-level static assets
|- docs/               Project documents
|- frontend/           Vue 3 + Vite frontend
|  |- src/
|  |- public/
|- internal/
|  |- agent/           Agent process lifecycle management
|  |- config/          Agent config loading, saving, and hot reload
|  |- store/           Local JSON store management
|  |- system/          Version and machine-level helpers
|- main.go             Wails bootstrap
|- wails.json          Wails build/dev configuration
```

## Requirements

- Go 1.22 or newer
- Node.js 18+ and npm
- Wails CLI

Install the Wails CLI:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

## Install

Install frontend dependencies:

```bash
cd frontend
npm install
```

## Run In Development

Start the full desktop app with Wails:

```bash
wails dev
```

Or from the frontend folder:

```bash
cd frontend
npm run wails:dev
```

If you only need the frontend dev server:

```bash
cd frontend
npm run dev
```

## Build

Build frontend assets:

```bash
cd frontend
npm run build
```

Build the desktop application:

```bash
wails build
```

Or from the frontend folder:

```bash
cd frontend
npm run wails:build
```

Verify the Go side separately:

```bash
go build ./...
```

## Agent Configuration

The app stores Agent definitions in the user config directory:

```text
<UserConfigDir>/acp_desktop/agents.json
```

On Windows this is typically similar to:

```text
%AppData%/acp_desktop/agents.json
```

Default Agents are initialized automatically on first launch. The config file uses a JSON structure like:

```json
{
  "agents": {
    "Claude Code": {
      "command": "npx",
      "args": ["@zed-industries/claude-code-acp@latest"],
      "env": {}
    }
  }
}
```

The app watches this file and reloads changes automatically.

## Local Stores

User preferences and session-related local data are stored under:

```text
<UserConfigDir>/acp_desktop/stores/
```

## Desktop Behavior

- Frameless desktop window
- Hide-on-close behavior
- Windows tray support with show, hide, and quit actions
- Frontend production assets are embedded into the Go binary from `frontend/dist`

## Useful Commands

```bash
cd frontend && npm run build
go build ./...
wails dev
wails build
```

## Acknowledgements

Special thanks to the [formulahendry/acp-ui](https://github.com/formulahendry/acp-ui) project for providing reference and inspiration for the product shape and feature design of this ACP desktop client.

## Notes

- The main application title is `ACP DESKTOP`.
- The primary README is written in Chinese.
- See [README.md](./README.md) for the Chinese version.
