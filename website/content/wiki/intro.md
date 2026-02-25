---
title: "Introduction"
order: 1
excerpt: "Welcome to the Tabularis Wiki. Learn how to get started with the most modern database management tool."
---

# Introduction

**Tabularis** is a modern, lightweight, developer-focused database management tool built from the ground up to solve the frustrations of existing enterprise solutions. By combining the safety and performance of **Rust (via Tauri)** with the rich interactivity of **React**, Tabularis delivers a blazing-fast, secure, and beautiful data management experience.

## Why Tabularis?

Traditional database GUI tools are often built on bulky JVMs or resource-heavy Electron frameworks, leading to sluggish performance, high memory usage, and cluttered interfaces. Tabularis takes a different approach:
- **Zero-Bloat Performance**: Leveraging Tauri, Tabularis uses the native OS webview, resulting in an installer under 20MB and RAM usage often below 100MB even with multiple tabs open.
- **Local-First & Privacy-Focused**: Your credentials, keys, and connection strings never leave your machine unless you explicitly configure a cloud AI provider.
- **Developer Experience (DX)**: Built-in SSH tunneling, context-aware SQL autocomplete, and native keychain integration mean you spend less time configuring and more time querying.

## Core Capabilities

- **Multi-Database Support**: Connect natively to PostgreSQL, MySQL, MariaDB, and SQLite.
- **Extensible Architecture**: Add support for any other engine (e.g., DuckDB, ClickHouse) via our language-agnostic JSON-RPC [Plugin System](/wiki/plugins).
- **Advanced SQL Editor**: Powered by Monaco, featuring real-time AST parsing for intelligent table and column completions.
- **Visual Data Tools**: Drag-and-drop Query Builder and auto-generated ER Diagrams.
- **AI-Powered Assistance**: Generate SQL or explain complex queries using OpenAI, Anthropic, or local Ollama models.

## System Requirements

Tabularis is truly cross-platform:
- **macOS**: 10.15+ (Universal Binary for Intel & Apple Silicon)
- **Windows**: Windows 10/11 (Requires WebView2 runtime, usually pre-installed)
- **Linux**: Ubuntu 20.04+, Arch, Fedora (Requires `webkit2gtk` and `libsecret`)

## Quick Start Guide

1. **Download & Install**: Grab the latest release from our [GitHub Releases page](https://github.com/debba/tabularis/releases).
2. **Add a Connection**: Click the `+` button in the sidebar. Choose your database type, enter your host details (e.g., `localhost:5432`), and provide your credentials. If your database is in a private subnet, configure the [SSH Tunnel](/wiki/connections) tab.
3. **Explore Data**: Double-click a table in the sidebar to open its data grid, or open a new SQL Editor tab (`Cmd/Ctrl + T`) to start writing queries.

---

![Tabularis Overview](/img/wiki-intro.png)
_Tabularis Overview — Main interface with connection list and SQL editor._
