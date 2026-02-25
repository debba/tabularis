---
title: "Themes & Customization"
order: 9
excerpt: "Personalize your workspace with 10+ built-in themes and full typography control."
---

# Themes & Customization

A developer tool should adapt to your preferences. Tabularis ships with a robust, CSS-variable-based theming engine that ensures every pixel—from the sidebar to the SQL editor—feels cohesive.

## Built-In Themes

Switch themes instantly in **Settings → General**. Changes apply immediately without requiring a restart or refreshing the DOM.
- **Dark Themes**: Tabularis Dark, Monokai, One Dark Pro, Nord, Dracula, GitHub Dark, Solarized Dark, High Contrast.
- **Light Themes**: Tabularis Light, Solarized Light.
- **System Sync**: Choose "Auto" to have Tabularis track your OS's dark/light mode preference dynamically.

## Typography Configuration

Readability is critical when parsing logs or complex queries.
- **Font Family**: You can use any monospace font installed on your system. We highly recommend coding-specific fonts like *JetBrains Mono*, *Fira Code*, or *Cascadia Code*.
- **Ligatures**: If your chosen font supports programming ligatures (e.g., combining `<=` into `≤`), Tabularis and the Monaco editor will render them natively.
- **Font Size & Weight**: Fully adjustable via the UI.

## Creating Custom Themes

Tabularis is styled using a strict set of global CSS variables. You can create your own theme by injecting a custom CSS payload.

### The CSS Variable Contract
The UI relies on a specific set of color tokens. To build a theme, you define these variables within a `.theme-my-custom` class:

```css
.theme-dracula {
  --bg-primary: #282a36;
  --bg-secondary: #21222c;
  --text-primary: #f8f8f2;
  --text-muted: #6272a4;
  --accent-color: #bd93f9;
  --accent-hover: #ff79c6;
  --border-color: #44475a;
  
  /* Syntax Highlighting Base */
  --monaco-keyword: #ff79c6;
  --monaco-string: #f1fa8c;
  --monaco-number: #bd93f9;
}
```

### Monaco Editor Integration
The most complex part of theming a database tool is ensuring the SQL syntax highlighting matches the UI. 
Tabularis bridges this gap automatically. When a theme changes, the application reads the `--monaco-*` CSS variables and constructs a dynamic Monaco Theme object on the fly, applying it to the editor. This guarantees that your strings, keywords, and UI accents are always perfectly synchronized.
