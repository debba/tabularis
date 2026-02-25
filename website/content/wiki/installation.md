---
title: "Installation"
order: 1.5
excerpt: "Download and install Tabularis on macOS, Windows, or Linux."
---

# Installation

Tabularis ships as a native desktop application built with Tauri. There are no servers, no sign-ups, and no internet connection required to run it.

## System Requirements

| Platform | Minimum | Notes |
| :--- | :--- | :--- |
| **macOS** | 10.15+ | Universal Binary (Intel + Apple Silicon) |
| **Windows** | 10 / 11 | WebView2 required (pre-installed with Edge) |
| **Linux** | Ubuntu 20.04+ | Requires `webkit2gtk-4.1` and `libsecret-1` |

### Linux: install required system libraries

```bash
# Debian / Ubuntu
sudo apt install libwebkit2gtk-4.1-dev libsecret-1-dev

# Arch Linux
sudo pacman -S webkit2gtk libsecret

# Fedora
sudo dnf install webkit2gtk4.1-devel libsecret-devel
```

## Download a binary

Download the package for your platform from [GitHub Releases](https://github.com/debba/tabularis/releases):

| Platform | Package |
| :--- | :--- |
| **macOS** | `.dmg` |
| **Windows** | `.msi` or `.exe` |
| **Linux** | `.AppImage`, `.deb`, or `.rpm` |

### macOS

Open the `.dmg`, drag **tabularis** to your Applications folder, then launch it. On first run, macOS may ask you to confirm opening an app from the internet — click **Open**.

### Windows

Run the `.msi` installer and follow the wizard, or use the standalone `.exe` if you prefer not to install. WebView2 is required; it ships pre-installed with Microsoft Edge and is present on all up-to-date Windows 10/11 machines.

### Linux — AppImage

```bash
chmod +x tabularis_*.AppImage
./tabularis_*.AppImage
```

### Linux — .deb

```bash
sudo dpkg -i tabularis_*.deb
```

### Linux — .rpm

```bash
sudo rpm -i tabularis_*.rpm
```

## Updates

Tabularis checks for new releases against the GitHub Releases API on startup (if `autoCheckUpdatesOnStartup` is enabled, which is the default). When an update is available, a notification appears in the UI with the option to download and install it automatically.

To disable update checks, set `checkForUpdates: false` in your `config.json`. See [Configuration](/wiki/configuration) for the full reference.

## Build from source

You need:

- **Rust** (edition 2021 — install via [rustup](https://rustup.rs))
- **Node.js** (LTS recommended) with `npm`
- **Tauri CLI v2** (installed automatically as a local dev dependency)

```bash
# 1. Clone the repository
git clone https://github.com/debba/tabularis.git
cd tabularis

# 2. Install frontend dependencies
npm install

# 3a. Start the development build (hot-reload)
npm run tauri dev

# 3b. Produce a release binary
npm run tauri build
```

The compiled binary and installer packages are written to `src-tauri/target/release/bundle/`.
