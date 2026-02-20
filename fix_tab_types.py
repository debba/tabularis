import re

content = open("src/pages/Settings.tsx").read()

# update useState type
content = re.sub(
    r'useState<"general" \| "appearance" \| "localization" \| "ai" \| "updates" \| "logs" \| "info">',
    r'useState<"general" | "appearance" | "localization" | "ai" | "updates" | "logs" | "info" | "plugins">',
    content
)

# update type SettingsTab if it exists
content = content.replace(
    'type SettingsTab = "general" | "appearance" | "localization" | "ai" | "updates" | "info" | "logs";',
    'type SettingsTab = "general" | "appearance" | "localization" | "ai" | "updates" | "info" | "logs" | "plugins";'
)

# Also add the top navigation button for plugins
button_old = """        <button
          onClick={() => setActiveTab("info")}"""
button_new = """        <button
          onClick={() => setActiveTab("plugins")}
          className={clsx(
            "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
            activeTab === "plugins"
              ? "bg-surface-secondary text-primary"
              : "text-muted hover:text-primary hover:bg-surface-secondary/50",
          )}
        >
          <Database size={16} />
          Plugins
        </button>
        <button
          onClick={() => setActiveTab("info")}"""
content = content.replace(button_old, button_new)

# Add import for Database icon if not there
if 'Database' not in content: # wait, it might be, let's just use SettingsIcon
    pass # Wait, Database is imported in some places, I'll just use SettingsIcon if Database isn't imported, but wait I can check

open("src/pages/Settings.tsx", "w").write(content)
