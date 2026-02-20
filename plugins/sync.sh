#!/usr/bin/env bash
# Builds all plugins in this directory and installs them into
# the Tabularis plugins folder for the current OS.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Resolve the Tabularis plugins directory based on OS
case "$(uname -s)" in
  Linux*)
    PLUGINS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/tabularis/plugins"
    ;;
  Darwin*)
    PLUGINS_DIR="$HOME/Library/Application Support/com.debba.tabularis/plugins"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    PLUGINS_DIR="${APPDATA}/com.debba.tabularis/plugins"
    ;;
  *)
    echo "Unsupported OS: $(uname -s)" >&2
    exit 1
    ;;
esac

echo "Target plugins directory: $PLUGINS_DIR"

# Process each subdirectory that contains a manifest.json
for plugin_src in "$SCRIPT_DIR"/*/; do
  manifest="$plugin_src/manifest.json"
  if [[ ! -f "$manifest" ]]; then
    continue
  fi

  plugin_id=$(grep -o '"id"\s*:\s*"[^"]*"' "$manifest" | head -1 | sed 's/.*: *"\(.*\)"/\1/')
  executable=$(grep -o '"executable"\s*:\s*"[^"]*"' "$manifest" | head -1 | sed 's/.*: *"\(.*\)"/\1/')

  if [[ -z "$plugin_id" || -z "$executable" ]]; then
    echo "  [SKIP] $plugin_src — could not parse manifest.json" >&2
    continue
  fi

  echo ""
  echo "==> Plugin: $plugin_id"

  # Build if it's a Rust crate
  if [[ -f "$plugin_src/Cargo.toml" ]]; then
    echo "  Building (cargo build --release)..."
    cargo build --release --manifest-path "$plugin_src/Cargo.toml"
  fi

  dest_dir="$PLUGINS_DIR/$plugin_id"
  mkdir -p "$dest_dir"

  # Copy manifest
  cp "$manifest" "$dest_dir/manifest.json"
  echo "  Copied manifest.json"

  # Find and copy the compiled executable
  # Look in the plugin's own target/release first, then the workspace target/release
  bin_paths=(
    "$plugin_src/target/release/$executable"
    "$SCRIPT_DIR/../src-tauri/target/release/$executable"
    "$SCRIPT_DIR/target/release/$executable"
  )

  copied=false
  for bin_path in "${bin_paths[@]}"; do
    if [[ -f "$bin_path" ]]; then
      cp "$bin_path" "$dest_dir/$executable"
      chmod +x "$dest_dir/$executable"
      echo "  Copied executable: $executable"
      copied=true
      break
    fi
  done

  if [[ "$copied" == false ]]; then
    echo "  [WARN] Executable '$executable' not found. Build may have failed." >&2
  fi

  echo "  Installed to: $dest_dir"
done

echo ""
echo "Sync complete. Restart Tabularis to load updated plugins."
