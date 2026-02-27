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

## macOS

### Homebrew (recommended)

```bash
brew tap debba/tabularis
brew install --cask tabularis
```

[![Homebrew](https://img.shields.io/badge/Homebrew-Repository-orange?logo=homebrew)](https://github.com/debba/homebrew-tabularis)

### Direct download

Download the `.dmg` from [GitHub Releases](https://github.com/debba/tabularis/releases), open it, drag **tabularis** to your Applications folder, then launch it.

If macOS blocks the app with a "cannot be opened" warning (Gatekeeper quarantine), run:

```bash
xattr -c /Applications/tabularis.app
```

> If you are **upgrading** and Tabularis was already in the Accessibility list in Privacy & Security, remove the old entry before granting access to the new version.

## Windows

Download `tabularis_x.x.x_x64-setup.exe` from [GitHub Releases](https://github.com/debba/tabularis/releases) and run it. Follow the on-screen instructions.

WebView2 is required — it ships pre-installed with Microsoft Edge and is present on all up-to-date Windows 10/11 machines.

## Linux

### Snap (recommended for Ubuntu / Debian)

```bash
sudo snap install tabularis
```

[![Snap Store](https://img.shields.io/badge/snap-tabularis-blue?logo=snapcraft)](https://snapcraft.io/tabularis)

### AppImage

Download the `.AppImage` from [GitHub Releases](https://github.com/debba/tabularis/releases), make it executable and run it:

```bash
chmod +x tabularis_*.AppImage
./tabularis_*.AppImage
```

### .deb (Debian / Ubuntu)

```bash
sudo dpkg -i tabularis_*.deb
```

### .rpm (Fedora / RHEL)

```bash
sudo rpm -i tabularis_*.rpm
```

### Arch Linux (AUR)

```bash
yay -S tabularis-bin
```

[![AUR](https://img.shields.io/badge/AUR-tabularis--bin-1793D1?logo=archlinux&logoColor=white)](https://aur.archlinux.org/packages/tabularis-bin)

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
