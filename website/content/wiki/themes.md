---
title: "Themes & Customization"
order: 9
excerpt: "Personalize your workspace with 10 built-in themes and full typography control."
---

# Themes & Customization

A developer tool should adapt to your preferences. Tabularis ships with a robust, CSS-variable-based theming engine that ensures every pixel—from the sidebar to the SQL editor—feels cohesive.

## Built-In Themes

Switch themes instantly in **Settings → Appearance**. Changes apply immediately without requiring a restart or refreshing the DOM.
- **Dark Themes**: Tabularis Dark, Monokai, One Dark Pro, Nord, Dracula, GitHub Dark, Solarized Dark, High Contrast.
- **Light Themes**: Tabularis Light, Solarized Light.

## Typography Configuration

Readability is critical when parsing logs or complex queries.
- **Font Family**: You can use any monospace font installed on your system. We highly recommend coding-specific fonts like *JetBrains Mono*, *Fira Code*, or *Cascadia Code*.
- **Ligatures**: If your chosen font supports programming ligatures (e.g., combining `<=` into `≤`), Tabularis and the Monaco editor will render them natively.
- **Font Size & Weight**: Fully adjustable via the UI.

## CSS Variables

Tabularis applies themes by setting CSS custom properties on the `<html>` element. The full set of variables used by the UI is:

```css
/* Background */
--bg-base, --bg-elevated, --bg-overlay, --bg-input, --bg-tooltip

/* Surface */
--surface-primary, --surface-secondary, --surface-tertiary
--surface-hover, --surface-active, --surface-disabled

/* Text */
--text-primary, --text-secondary, --text-muted
--text-disabled, --text-accent, --text-inverse

/* Accent */
--accent-primary, --accent-secondary
--accent-success, --accent-warning, --accent-error, --accent-info

/* Border */
--border-subtle, --border-default, --border-strong, --border-focus

/* Semantic (data grid cell values) */
--semantic-string, --semantic-number, --semantic-boolean, --semantic-date
--semantic-null, --semantic-pk, --semantic-fk, --semantic-index
--semantic-modified, --semantic-deleted, --semantic-new

/* Typography */
--font-base, --font-mono

/* Layout */
--radius-sm, --radius-base, --radius-lg, --radius-xl
```

## Monaco Editor Integration

For built-in preset themes (Monokai, Dracula, Nord, GitHub Dark, etc.) Tabularis loads a matching dedicated Monaco JSON theme file. For custom themes, Monaco colors are derived automatically from the theme's color object. In both cases the switch is instantaneous and requires no restart.
