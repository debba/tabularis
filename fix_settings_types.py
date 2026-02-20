content = open("src/pages/Settings.tsx").read()
content = content.replace('type SettingsTab = "general" | "appearance" | "localization" | "ai" | "updates" | "info" | "logs";', 'type SettingsTab = "general" | "appearance" | "localization" | "ai" | "updates" | "info" | "logs" | "plugins";')
content = content.replace("const { allDrivers } = useDrivers();", "const { allDrivers } = useDrivers();") # actually nothing to replace here, just keeping it
# If the previous regex failed to replace `{drivers.map`, do it now
content = content.replace("{drivers.map(driver => {", "{allDrivers.map(driver => {")
open("src/pages/Settings.tsx", "w").write(content)
