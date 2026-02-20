content = open("src/components/ui/NewConnectionModal.tsx").read()

# Remove local type alias
content = content.replace('type Driver = "postgres" | "mysql" | "sqlite";\n\n', '')
content = content.replace('import { SearchableSelect } from "./SearchableSelect";', 'import { SearchableSelect } from "./SearchableSelect";\nimport { useDrivers } from "../../hooks/useDrivers";\nimport type { PluginManifest } from "../../types/plugins";')
content = content.replace('driver: Driver;', 'driver: string;')
content = content.replace('const [driver, setDriver] = useState<Driver>("postgres");', 'const { drivers } = useDrivers();\n  const [driver, setDriver] = useState<string>("postgres");\n  const activeDriver = drivers.find((d) => d.id === driver) ?? drivers[0];')
content = content.replace('const handleDriverChange = (newDriver: Driver) => {', 'const handleDriverChange = (newDriver: string) => {')

# Replace the static driver buttons mapping
old_buttons = """              {(["mysql", "postgres", "sqlite"] as Driver[]).map((d) => (
                <button
                  key={d}
                  onClick={() => handleDriverChange(d)}
                  className={clsx(
                    "px-4 py-2 rounded border text-sm font-medium capitalize flex-1",
                    driver === d
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-elevated border-strong text-secondary hover:border-strong",
                  )}
                >
                  {d}
                </button>
              ))}"""
new_buttons = """              {drivers.map((d: PluginManifest) => (
                <button
                  key={d.id}
                  onClick={() => handleDriverChange(d.id)}
                  className={clsx(
                    "px-4 py-2 rounded border text-sm font-medium capitalize flex-1",
                    driver === d.id
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-elevated border-strong text-secondary hover:border-strong",
                  )}
                >
                  {d.name}
                </button>
              ))}"""
content = content.replace(old_buttons, new_buttons)

# Fix conditional rendering logic
content = content.replace('{driver !== "sqlite" && (', '{activeDriver?.capabilities?.file_based === false && (')
content = content.replace('{driver === "sqlite" ? (', '{activeDriver?.capabilities?.file_based === true ? (')
content = content.replace('if (driver === "sqlite") {', 'if (activeDriver?.capabilities?.file_based === true) {')

# Fix port logic inside handleDriverChange
old_port_logic = """      port:
        newDriver === "postgres"
          ? 5432
          : newDriver === "mysql"
            ? 3306
            : undefined,
      username: newDriver === "postgres" ? "postgres" : "root","""
new_port_logic = """      port: drivers.find(d => d.id === newDriver)?.default_port ?? undefined,
      username: newDriver === "postgres" ? "postgres" : (newDriver === "mysql" ? "root" : ""),"""
content = content.replace(old_port_logic, new_port_logic)

open("src/components/ui/NewConnectionModal.tsx", "w").write(content)
