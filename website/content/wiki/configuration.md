---
title: "Configuration"
order: 3
excerpt: "Adjust Tabularis to your workflow: language settings, SSH keys, and general application behavior."
---

# Configuration

Tabularis is designed to work perfectly out-of-the-box, but offers extensive configuration options via the UI **Settings** panel and an underlying `config.json` file.

## General Settings

- **Language Support**: Native translations for **English**, **Italian**, and **Spanish**. The app defaults to your OS locale.
- **Startup Behavior**: Configure whether to launch with a blank slate or restore the exact tabs, split-pane layouts, and active connections from your previous session.

## Storage Paths & config.json

Tabularis stores non-sensitive configuration, UI preferences, and connection metadata in a central `config.json`. **Passwords and SSH passphrases are NEVER stored here.**

### File Locations

- **Windows**: `%APPDATA%\io.github.debba.tabularis\config.json`
- **macOS**: `~/Library/Application Support/io.github.debba.tabularis/config.json`
- **Linux**: `~/.config/io.github.debba.tabularis/config.json`

### `config.json` Reference

The configuration file is a typed JSON object. You can edit it manually (while the app is closed) if necessary:

| Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `theme` | `string` | `"tabularis-dark"` | Active UI theme ID. |
| `language` | `string` | `"auto"` | Preferred locale (`en`, `it`, `es`, or `auto`). |
| `resultPageSize` | `number` | `100` | Rows fetched per pagination request in the grid. |
| `fontFamily` | `string` | `"JetBrains Mono"` | Editor font. Must be installed on the system. |
| `fontSize` | `number` | `14` | Editor font size in pixels. |
| `aiEnabled` | `boolean` | `false` | Master toggle for AI features. |
| `aiProvider` | `string` | `"openai"` | Active provider (`openai`, `anthropic`, `ollama`). |
| `aiModel` | `string` | `"gpt-4o"` | The model identifier. |
| `aiOllamaPort` | `number` | `11434` | Local port for Ollama daemon. |
| `aiCustomOpenaiUrl` | `string` | `null` | Base URL for OpenAI-compatible endpoints (e.g., LM Studio). |
| `autoCheckUpdatesOnStartup` | `boolean` | `true` | Checks GitHub releases on boot. |
| `erDiagramDefaultLayout`| `string` | `"TB"` | `TB` (Top-Bottom) or `LR` (Left-Right) for Dagre layout. |
| `maxBlobSize` | `number` | `1048576` | Max bytes (1MB) to load into UI for BLOB columns. |

## Application Logs

For debugging connection failures or plugin crashes, Tabularis writes detailed logs:
- **macOS**: `~/Library/Logs/io.github.debba.tabularis/`
- **Windows**: `%APPDATA%\io.github.debba.tabularis\logs\`
- **Linux**: `~/.cache/io.github.debba.tabularis/`

You can also launch Tabularis from the terminal with the `RUST_LOG` environment variable for real-time debug output:
```bash
RUST_LOG=debug tabularis
```

## Privacy & Telemetry

Tabularis respects your privacy.
- **Zero Telemetry**: We do not embed Google Analytics, Mixpanel, or any tracking SDKs.
- **Local Isolation**: All parsing, AST generation, and layout calculation happen locally. Network requests are only made to your database host, GitHub (for update checks), or your chosen AI provider (if explicitly enabled).
