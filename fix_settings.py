content = open("src/pages/Settings.tsx").read()
content = content.replace("const { drivers } = useDrivers();", "const { allDrivers } = useDrivers();")
content = content.replace("{drivers.map(driver => {", "{allDrivers.map(driver => {")
open("src/pages/Settings.tsx", "w").write(content)
