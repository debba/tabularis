# Plugin UI Extensions Specification

> **Status:** Implemented
> **Version:** 0.2
> **Date:** 2026-03-15
>
> This document was drafted with the help of [Claude Code](https://claude.com/claude-code) after an initial design phase where I explored different approaches and defined the core requirements. Claude Code then analyzed the existing plugin architecture and component hierarchy across the codebase to turn those ideas into a structured specification.

## 1. Overview

Tabularis plugins currently provide driver capabilities, settings, and registry integration — but they have **no mechanism to extend the UI**. This specification defines a **slot-based UI extension system** that allows plugins to inject React components into predefined insertion points throughout the application.

### Goals

- Allow plugins to render custom UI (fields, buttons, menu items) inside the host application.
- Keep the host app in full control of layout, ordering, and error isolation.
- Provide a typed, React-idiomatic API that plugin authors can adopt incrementally.
- Avoid runtime `eval` or arbitrary DOM manipulation — all contributions are React components registered through a controlled registry.
- **Zero breaking changes** to the existing plugin system (see [Section 9](#9-backward-compatibility)).

### Non-Goals

- Arbitrary page routing or full-page plugin views (future work).
- Theming or style overrides beyond what slot context exposes.
- Server-side / Rust-side UI rendering.

---

## 2. Architecture

The system has three layers:

```
┌─────────────────────────────────────────────┐
│  Host Application                           │
│                                             │
│   <SlotAnchor name="data-grid.toolbar...">  │  ← Defines WHERE
│       ↕                                     │
│   PluginSlotRegistry (React Context)        │  ← Holds WHAT
│       ↕                                     │
│   Plugin Module (registers components)      │  ← Provides WHAT
└─────────────────────────────────────────────┘
```

1. **`SlotAnchor`** — A host component placed at each insertion point. It reads the registry for contributions matching its `name` prop and renders them with the appropriate slot context.
2. **`PluginSlotRegistry`** — A React context + provider that stores all registered slot contributions, keyed by `slotName + pluginId`.
3. **Plugin Module** — A JS/TS module exported by the plugin that calls registration functions during its activation lifecycle.

---

## 3. Slot Registry

### 3.1 Types

```typescript
/** All built-in slot locations where plugins can inject UI. */
type SlotName =
  | "row-edit-modal.field.after"
  | "row-edit-modal.footer.before"
  | "row-editor-sidebar.field.after"
  | "row-editor-sidebar.header.actions"
  | "data-grid.toolbar.actions"
  | "data-grid.context-menu.items"
  | "sidebar.footer.actions"
  | "settings.plugin.actions";

/** Context data provided to every slot component via props. */
interface SlotContext {
  connectionId?: string | null;
  tableName?: string | null;
  schema?: string | null;
  driver?: string | null;
  rowData?: Record<string, unknown>;
  columnName?: string;
  rowIndex?: number;
  isInsertion?: boolean;
  targetPluginId?: string;
  [key: string]: unknown;
}

/** Standard props every slot component receives. */
interface SlotComponentProps {
  /** The slot context data from the host component. */
  context: SlotContext;
  /** The plugin that owns this component. */
  pluginId: string;
}

/** A UI contribution registered by a plugin. */
interface SlotContribution {
  /** Plugin identifier. */
  pluginId: string;
  /** Target slot name. */
  slot: SlotName;
  /** React component to render. */
  component: ComponentType<SlotComponentProps>;
  /** Ordering weight (lower = earlier). Defaults to 100. */
  order?: number;
  /** Optional predicate to conditionally show the component. */
  when?: (context: SlotContext) => boolean;
}
```

### 3.2 `PluginSlotRegistry` Context

```typescript
interface PluginSlotRegistryType {
  /** All registered contributions. */
  contributions: SlotContribution[];
  /** Register a new contribution. Returns an unregister function. */
  register: (contribution: SlotContribution) => () => void;
  /** Register multiple contributions at once. Returns an unregister-all function. */
  registerAll: (contributions: SlotContribution[]) => () => void;
  /** Get sorted, filtered contributions for a given slot. */
  getSlotContributions: (slot: SlotName, context: SlotContext) => SlotContribution[];
}
```

The `PluginSlotProvider` is placed in `App.tsx` near the root of the component tree, alongside existing providers:

```tsx
<KeybindingsProvider>
  <PluginSlotProvider>
    <ConnectionLayoutProvider>
      {/* app content */}
    </ConnectionLayoutProvider>
  </PluginSlotProvider>
</KeybindingsProvider>
```

### 3.3 `SlotAnchor` Component

```typescript
interface SlotAnchorProps {
  /** The slot location name. */
  name: SlotName;
  /** Context data provided to slot components. */
  context: SlotContext;
  /** Optional CSS class for the wrapper div (only rendered when contributions exist). */
  className?: string;
}
```

Rendering behaviour:

1. Read contributions from the registry for `props.name` via `getSlotContributions()`.
2. Contributions are already filtered by `when` predicate and sorted by `order`.
3. Render each contribution's `component` inside a `SlotErrorBoundary`, passing `context` and `pluginId` as props.
4. If no contributions survive, render nothing (`null`) — the anchor is invisible.
5. When contributions exist, a `<div>` wrapper is rendered with a `data-slot` attribute for debugging.

---

## 4. Built-in Slot Locations

The following slots are defined in the initial release. Each slot name is a dot-delimited path describing its location.

### 4.1 `row-edit-modal.field.after`

**Location:** `NewRowModal` — rendered after each field input.

| Property | Value |
|----------|-------|
| **Host component** | `src/components/modals/NewRowModal.tsx` |
| **Renders per** | Each column in the table |
| **Context type** | `RowFieldSlotContext` |

```typescript
interface RowFieldSlotContext {
  /** Current column metadata. */
  column: TableColumn;
  /** Current field value (may be null). */
  value: unknown;
  /** All current row values keyed by column name. */
  rowValues: Record<string, unknown>;
  /** Whether the field is for a new insertion. Always true in NewRowModal. */
  isInsertion: boolean;
  /** Active connection ID, if any. */
  connectionId: string | null;
  /** Table name. */
  tableName: string;
  /** Active driver capabilities. */
  capabilities: DriverCapabilities;
}
```

**Use cases:** Custom validation messages, computed-field previews, foreign-key lookup widgets.

### 4.2 `row-edit-modal.footer.before`

**Location:** `NewRowModal` — rendered before the Save / Cancel buttons.

| Property | Value |
|----------|-------|
| **Host component** | `src/components/modals/NewRowModal.tsx` |
| **Renders per** | Once per modal instance |
| **Context type** | `RowModalFooterSlotContext` |

```typescript
interface RowModalFooterSlotContext {
  /** All current row values keyed by column name. */
  rowValues: Record<string, unknown>;
  /** Table name. */
  tableName: string;
  /** Active connection ID. */
  connectionId: string | null;
  /** Active driver capabilities. */
  capabilities: DriverCapabilities;
}
```

**Use cases:** Bulk-default buttons, "fill from template" actions, pre-save hooks UI.

### 4.3 `row-editor-sidebar.field.after`

**Location:** `RowEditorSidebar` — rendered after each `FieldEditor`.

| Property | Value |
|----------|-------|
| **Host component** | `src/components/ui/RowEditorSidebar.tsx` |
| **Renders per** | Each column in the row |
| **Context type** | `RowFieldSlotContext` (same as 4.1) |

**Use cases:** Same as `row-edit-modal.field.after` but within the sidebar editing flow.

### 4.4 `row-editor-sidebar.header.actions`

**Location:** `RowEditorSidebar` — rendered inside the header area, after the title.

| Property | Value |
|----------|-------|
| **Host component** | `src/components/ui/RowEditorSidebar.tsx` |
| **Renders per** | Once per sidebar instance |
| **Context type** | `RowEditorHeaderSlotContext` |

```typescript
interface RowEditorHeaderSlotContext {
  /** Full row data keyed by column name. */
  rowData: Record<string, unknown>;
  /** Row index in the current result set. */
  rowIndex: number;
  /** Whether the row is a new insertion. */
  isInsertion: boolean;
  /** Active connection ID. */
  connectionId: string | null;
  /** Table name. */
  tableName: string | null;
  /** Primary key column, if known. */
  pkColumn: string | null;
  /** Schema name, if applicable. */
  schema: string | null;
}
```

**Use cases:** "Copy as JSON" button, "Open in external editor" action, audit-trail link.

### 4.5 `data-grid.toolbar.actions`

**Location:** `TableToolbar` / `DataGrid` — rendered in the toolbar action area.

| Property | Value |
|----------|-------|
| **Host component** | `src/components/ui/TableToolbar.tsx` |
| **Renders per** | Once per table view |
| **Context type** | `DataGridToolbarSlotContext` |

```typescript
interface DataGridToolbarSlotContext {
  /** Current table name. */
  tableName: string | null;
  /** Active connection ID. */
  connectionId: string | null;
  /** Column metadata for the current table. */
  columnMetadata: TableColumn[];
  /** Current filter (WHERE clause). */
  currentFilter: string;
  /** Current sort (ORDER BY clause). */
  currentSort: string;
  /** Current row limit. */
  currentLimit: number | undefined;
  /** Active driver capabilities. */
  capabilities: DriverCapabilities;
}
```

**Use cases:** Export buttons (CSV, Parquet), "Run plugin analysis" action, data-profiling trigger.

### 4.6 `data-grid.context-menu.items`

**Location:** `DataGrid` context menu — extra items appended to the existing menu.

| Property | Value |
|----------|-------|
| **Host component** | `src/components/ui/DataGrid.tsx` |
| **Renders per** | Each context-menu open event |
| **Context type** | `DataGridContextMenuSlotContext` |

```typescript
interface DataGridContextMenuSlotContext {
  /** Values of the right-clicked row, keyed by column name. */
  rowData: Record<string, unknown>;
  /** Index of the right-clicked row. */
  rowIndex: number;
  /** Name of the column that was right-clicked. */
  columnName: string;
  /** Cell value at the click location. */
  cellValue: unknown;
  /** All currently selected row indices. */
  selectedRows: Set<number>;
  /** Table name. */
  tableName: string | null;
  /** Active connection ID. */
  connectionId: string | null;
  /** Primary key column. */
  pkColumn: string | null;
}
```

Because the context menu uses a flat `ContextMenuItem[]` array, plugin contributions for this slot return menu items rather than arbitrary JSX:

```typescript
interface ContextMenuSlotComponentProps
  extends SlotComponentProps<DataGridContextMenuSlotContext> {
  /**
   * Callback to add items to the context menu.
   * Called during render; items are collected and merged by the host.
   */
  contributeItems: (items: ContextMenuItem[]) => void;
}
```

**Use cases:** "Look up in external service", "Copy row as INSERT statement", "Bookmark row".

### 4.7 `sidebar.footer.actions`

**Location:** `Sidebar` — rendered in the footer area.

| Property | Value |
|----------|-------|
| **Host component** | `src/components/layout/Sidebar.tsx` |
| **Renders per** | Once (global) |
| **Context type** | `SidebarFooterSlotContext` |

```typescript
interface SidebarFooterSlotContext {
  /** Active connection ID, if any. */
  connectionId: string | null;
  /** Active driver ID, if any. */
  driverId: string | null;
  /** Active driver capabilities, if connected. */
  capabilities: DriverCapabilities | null;
}
```

**Use cases:** Quick-action buttons, plugin status indicators, notification badges.

### 4.8 `settings.plugin.actions`

**Location:** `Settings` — rendered next to each installed plugin's action buttons (enable/disable toggle, settings gear, remove).

| Property | Value |
|----------|-------|
| **Host component** | `src/pages/Settings.tsx` |
| **Renders per** | Each installed plugin in the Settings plugin list |
| **Context type** | `SettingsPluginSlotContext` |

```typescript
interface SettingsPluginSlotContext {
  /** The ID of the plugin this action area belongs to. */
  targetPluginId: string;
}
```

**Use cases:** Custom plugin management actions, diagnostics buttons, configuration shortcuts, plugin-specific status indicators.

---

## 5. Plugin Manifest Extension

The `PluginManifest` type gains a single new **optional** field `ui_extensions`. All existing fields are untouched — plugins without this field continue to work identically (see [Section 9](#9-backward-compatibility)):

```typescript
interface PluginManifest {
  // ... existing fields (id, name, version, capabilities, settings, etc.)

  /**
   * UI extension declarations.
   * Each entry describes a slot contribution and the module that provides it.
   */
  ui_extensions?: UIExtensionDeclaration[];
}

interface UIExtensionDeclaration {
  /** Target slot name. Must be a known built-in slot. */
  slot: string;
  /**
   * Path to the JS/TS module exporting the component, relative to the
   * plugin root. The module must have a default export that is a valid
   * React component accepting `SlotComponentProps<T>`.
   */
  module: string;
  /** Ordering weight (default 100). */
  order?: number;
  /**
   * Static conditions evaluated before loading the module.
   * If any condition is false, the module is never imported.
   */
  conditions?: {
    /** Only load for these driver IDs. */
    drivers?: string[];
    /** Only load when these capabilities are true. */
    capabilities?: (keyof DriverCapabilities)[];
  };
}
```

### Example manifest snippet

```json
{
  "id": "postgis-toolkit",
  "name": "PostGIS Toolkit",
  "version": "1.0.0",
  "description": "Geometry visualization and editing tools",
  "capabilities": { "schemas": true, "views": true },
  "settings": [],
  "ui_extensions": [
    {
      "slot": "row-editor-sidebar.field.after",
      "module": "./ui/GeometryPreview.tsx",
      "order": 50,
      "conditions": {
        "drivers": ["postgres"]
      }
    },
    {
      "slot": "data-grid.toolbar.actions",
      "module": "./ui/MapViewButton.tsx",
      "order": 80,
      "conditions": {
        "drivers": ["postgres"],
        "capabilities": ["schemas"]
      }
    }
  ]
}
```

---

## 6. Slot Context API

Every slot component receives props conforming to `SlotComponentProps<TContext>`. The `slotContext` value is assembled by the host at the `SlotAnchor` call site and varies per slot (see Section 4 for each slot's context type).

### 6.1 Common utilities available to slot components

In addition to `context`, plugin components can import from `@tabularis/plugin-api` (re-exported from `src/pluginApi.ts`):

```typescript
// @tabularis/plugin-api

/**
 * Execute a read-only query on the active connection.
 * Returns { executeQuery, loading, error }.
 */
export function usePluginQuery(): {
  executeQuery: (query: string) => Promise<{ columns: string[]; rows: unknown[][] }>;
  loading: boolean;
  error: string | null;
};

/** Access the current connection metadata. */
export function usePluginConnection(): {
  connectionId: string | null;
  driver: string | null;
  schema: string | null;
};

/** Show a notification dialog. */
export function usePluginToast(): {
  showInfo: (text: string) => Promise<void>;
  showError: (text: string) => Promise<void>;
  showWarning: (text: string) => Promise<void>;
};

/** Read/write a plugin's own settings. */
export function usePluginSetting(pluginId: string): {
  getSetting: <T = unknown>(key: string, defaultValue?: T) => T;
  setSetting: (key: string, value: unknown) => void;
};

/** Access the current theme. */
export function usePluginTheme(): {
  themeId: string | null;
  themeName: string | null;
  isDark: boolean;
  colors: Record<string, unknown> | null;
};
```

### 6.2 Prohibited APIs

Plugin components **must not** directly:

- Import from `@tauri-apps/*` (all Tauri access is mediated through `@tabularis/plugin-api`).
- Access `window.__TAURI__` or invoke Tauri commands.
- Manipulate the DOM outside their subtree.
- Use `localStorage` / `sessionStorage` directly (a scoped storage API will be provided in a future version).

---

## 7. Security

### 7.1 Sandboxing model

Plugin UI components run **in the same React tree** as the host (no iframe). Security is enforced through:

| Layer | Mechanism |
|-------|-----------|
| **Module loading** | Only modules declared in `ui_extensions` are imported. Dynamic `import()` of arbitrary paths is blocked. |
| **API surface** | `@tabularis/plugin-api` exposes a curated subset of host capabilities. Direct Tauri invoke is denied. |
| **Query access** | `usePluginQuery` is read-only by default. Write access requires an explicit `allow_write: true` flag in the manifest, surfaced to the user during plugin installation. |
| **Error isolation** | Each slot contribution is wrapped in a React `ErrorBoundary`. A crashing plugin component is replaced with a minimal fallback and does not bring down the host. |
| **CSP** | Content Security Policy headers prevent inline script injection. Plugin modules are loaded via controlled dynamic imports, not `eval`. |

### 7.2 Permissions

The manifest declares required permissions:

```typescript
interface UIExtensionDeclaration {
  // ... fields from Section 5

  permissions?: {
    /** Allow write queries (INSERT/UPDATE/DELETE) via usePluginQuery. Default false. */
    allow_write?: boolean;
    /** Allow network requests to these origins. Default: none. */
    allowed_origins?: string[];
  };
}
```

The user is prompted to approve permissions when activating a plugin that requests elevated access.

### 7.3 Review and trust

- Built-in plugins (`is_builtin: true`) are implicitly trusted.
- External plugins show a confirmation dialog listing requested slots, permissions, and the source repository before activation.

---

## 8. Lifecycle

### 8.1 Registration flow

```
App start
  │
  ├─ PluginSlotRegistryProvider mounts (empty registry)
  │
  ├─ SettingsProvider loads → activeExternalDrivers list
  │
  ├─ For each active plugin with ui_extensions:
  │     │
  │     ├─ Evaluate static conditions (driver match, capabilities)
  │     │
  │     ├─ Lazy-import the declared module
  │     │     └─ On failure → log error, skip contribution
  │     │
  │     └─ Call registry.register() with the loaded component
  │
  └─ SlotAnchor components render contributed components
```

### 8.2 Activation

A plugin's UI extensions are activated when:

1. The plugin is listed in `settings.activeExternalDrivers`.
2. The plugin manifest contains `ui_extensions`.
3. Static conditions (if any) are satisfied for the current connection context.

Activation is **lazy**: modules are imported only when a `SlotAnchor` matching the slot name first mounts, not at app startup.

### 8.3 Deactivation

When a plugin is removed from `activeExternalDrivers`:

1. `registry.unregister(pluginId)` is called.
2. All `SlotAnchor` components re-render and drop the plugin's contributions.
3. The imported module is eligible for garbage collection (no persistent references).

### 8.4 Hot reload during development

For plugin developers, the system supports hot module replacement:

1. Plugin author runs a dev server that watches their `ui/` directory.
2. On file change, the HMR runtime calls `registry.register()` with the updated component.
3. `SlotAnchor` components re-render with the new version.

### 8.5 Error boundaries

Each slot contribution is wrapped in a per-plugin `SlotErrorBoundary`:

```tsx
<SlotErrorBoundary pluginId={contribution.pluginId} slotName={name}>
  <Component context={context} pluginId={contribution.pluginId} />
</SlotErrorBoundary>
```

The `SlotErrorBoundary` is a React class component that catches rendering errors and displays a compact, non-intrusive fallback message (`"Plugin error: {pluginId}"`) styled as a small red badge. Errors are logged to the console with full component stack traces. The fallback does not disrupt the host layout, and other plugin contributions in the same slot continue rendering normally.

---

## 9. Backward Compatibility

This specification is designed as a **purely additive extension** to the existing plugin system. No existing types, interfaces, APIs, or behaviors are modified or removed.

### 9.1 Manifest compatibility

The `ui_extensions` field on `PluginManifest` is **optional** (`ui_extensions?: UIExtensionDeclaration[]`). Plugins that do not declare it continue to work exactly as before — they are loaded, registered, and configured through the same `useDrivers()`, `usePluginRegistry()`, and `PluginConfig` mechanisms without any change.

Existing manifest fields (`id`, `name`, `version`, `description`, `default_port`, `capabilities`, `is_builtin`, `default_username`, `color`, `icon`, `settings`) are **not modified** in any way. The new field is appended alongside them.

### 9.2 Rust-side manifest parsing

The Rust backend (`get_registered_drivers`) deserializes plugin manifests from JSON. Because `ui_extensions` is optional, the Rust struct must use `#[serde(default)]` so that manifests without the field continue to parse without errors. The backend does **not** need to interpret `ui_extensions` — it simply passes the raw value through to the frontend. This means:

- No changes to existing Tauri commands.
- No changes to the plugin installation or activation flow on the Rust side.
- No new IPC commands required for the initial implementation (slot registration is entirely frontend-side).

### 9.3 Settings and configuration

Plugin activation continues to be controlled by `settings.activeExternalDrivers` and `settings.plugins` (the `PluginConfig` record). No new settings keys are introduced. The `PluginSlotRegistryProvider` is a new context provider added to the component tree but it has **no effect** on existing providers or on plugins that do not declare `ui_extensions`.

### 9.4 Type safety

All new types (`SlotContribution`, `SlotComponentProps`, `UIExtensionDeclaration`, slot context interfaces) are **new exports** from new files. No existing type in `src/types/plugins.ts` is narrowed, widened, or restructured. The only change to the existing `PluginManifest` interface is the addition of the optional `ui_extensions` property — a non-breaking change under TypeScript's structural type system.

### 9.5 Runtime behavior

- If no plugins declare `ui_extensions`, the `PluginSlotRegistry` remains empty and all `SlotAnchor` components render nothing — zero overhead.
- `SlotAnchor` components are inserted into host components (e.g., `NewRowModal`, `DataGrid`) at specific locations, but they produce no DOM output when the registry is empty, so the visual layout is identical to the current state.
- Existing plugin lifecycle (load manifest → check `activeExternalDrivers` → resolve config → use driver) is unchanged. The UI extension lifecycle is a separate, parallel path that only activates when `ui_extensions` is present.

### 9.6 Migration path

| Plugin type | Action required |
|-------------|-----------------|
| Built-in drivers (postgres, mysql, sqlite) | None. No `ui_extensions` field needed. |
| Existing external plugins without UI | None. Continue to work as-is. |
| New plugins wanting UI extensions | Add `ui_extensions` to manifest. Older Tabularis versions that don't support the field will ignore it (unknown JSON fields are skipped by `serde(deny_unknown_fields)` is not used). |

---

## Appendix A: Slot Name Convention

Slot names follow the pattern:

```
<area>.<location>.<position>
```

- **area** — Top-level UI region (`row-edit-modal`, `data-grid`, `sidebar`).
- **location** — Specific element within the area (`field`, `toolbar`, `footer`, `header`, `context-menu`).
- **position** — Where relative to the element (`before`, `after`, `actions`, `items`).

New slots added in future versions must follow this convention.

## Appendix B: Full Type Summary

All types introduced in this specification:

| Type | Section | Purpose |
|------|---------|---------|
| `SlotName` | 3.1 | Union type of all valid slot names |
| `SlotContext` | 3.1 | Context data passed to slot components |
| `SlotContribution` | 3.1 | A registered component + metadata |
| `SlotComponentProps` | 3.1 | Props received by every slot component |
| `PluginSlotRegistryType` | 3.2 | Registry context API |
| `SlotAnchorProps` | 3.3 | Props for the host-side anchor component |
| `UIExtensionDeclaration` | 5 | Manifest entry for a UI extension |
| `RowFieldSlotContext` | 4.1 | Context for field-level slots |
| `RowModalFooterSlotContext` | 4.2 | Context for modal footer slot |
| `RowEditorHeaderSlotContext` | 4.4 | Context for sidebar header slot |
| `DataGridToolbarSlotContext` | 4.5 | Context for toolbar slot |
| `DataGridContextMenuSlotContext` | 4.6 | Context for context menu slot |
| `SidebarFooterSlotContext` | 4.7 | Context for sidebar footer slot |
| `SettingsPluginSlotContext` | 4.8 | Context for plugin settings slot |
