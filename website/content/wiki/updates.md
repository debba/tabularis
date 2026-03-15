---
title: "Updates"
order: 14
excerpt: "Keep Tabularis up to date — automatic checks on startup, manual check from settings, and package-manager-managed installs."
category: "Reference"
---

# Updates

![Seamless Updates](/img/tabularis-automatic-updates.png)

Tabularis can notify you when a new version is available and, depending on how you installed it, update itself automatically or guide you to do it manually.

## Automatic Update Check

By default, Tabularis queries the GitHub Releases API every time it starts. If a newer version is found, a notification appears in the UI with the release notes and a prompt to install it.

To disable automatic checks, set `autoCheckUpdatesOnStartup` to `false` in your `config.json`. See [Configuration](/wiki/configuration) for the full reference.

> Tabularis only **downloads** an update after you confirm the prompt — it never installs anything silently.

## Manual Update Check

Open **Settings → Info** and look for the **Updates** section. Click **Check for Updates** to query the API on demand. The panel shows your current version and, if an update is available, a button to download and install it.

## Package Manager Installs

When Tabularis detects it was installed via a system package manager, the built-in updater is disabled and the Updates panel shows a notice instead. Updates must be performed through the package manager itself.

### AUR (Arch Linux)

```bash
yay -Syu tabularis-bin
```

Tabularis shows **"Updates managed by AUR"** in the Info panel. The built-in update button is replaced by a reminder to use your AUR helper.

### Snap (Ubuntu / Debian)

Snap packages update automatically in the background. To force an immediate refresh:

```bash
sudo snap refresh tabularis
```

### Homebrew (macOS)

```bash
brew upgrade --cask tabularis
```

### winget (Windows)

```bash
winget upgrade --id debba.tabularis
```

## Which Version Am I Running?

The current version is always visible in **Settings → Info**, in the top-right badge on the Info card, and as a badge at the top of the [home page](/).
