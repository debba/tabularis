content = open("src/pages/Settings.tsx").read()

content = content.replace("const { allDrivers } = useDrivers();", "const { allDrivers } = useDrivers();")
content = content.replace("{drivers.map(driver => {", "{allDrivers.map(driver => {")

if 'import { Database' not in content:
    content = content.replace('import { Settings as SettingsIcon,', 'import { Database, Settings as SettingsIcon,')

# if allDrivers map still didn't apply:
import re
content = re.sub(r'\{drivers\.map\(driver => \{', r'{allDrivers.map((driver: PluginManifest) => {', content)
content = re.sub(r'\{allDrivers\.map\(driver => \{', r'{allDrivers.map((driver: PluginManifest) => {', content)
content = content.replace('import { useDrivers } from "../hooks/useDrivers";', 'import { useDrivers } from "../hooks/useDrivers";\nimport type { PluginManifest } from "../types/plugins";')

open("src/pages/Settings.tsx", "w").write(content)
