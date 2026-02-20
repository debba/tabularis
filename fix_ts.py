import re

# 1. SettingsContext.ts
content = open("src/contexts/SettingsContext.ts").read()
content = content.replace("disabledDrivers?: string[];", "activeExternalDrivers?: string[];")
open("src/contexts/SettingsContext.ts", "w").write(content)

# 2. useDrivers.ts
content = open("src/hooks/useDrivers.ts").read()
old_logic = """  const disabled = settings.disabledDrivers || [];
  let active = allDrivers.filter(d => !disabled.includes(d.id));
  if (active.length === 0) active = allDrivers;"""
new_logic = """  const builtin = ["mysql", "postgres", "sqlite"];
  const activeExt = settings.activeExternalDrivers || [];
  const active = allDrivers.filter(d => builtin.includes(d.id) || activeExt.includes(d.id));"""
content = content.replace(old_logic, new_logic)
content = content.replace("settings.disabledDrivers", "settings.activeExternalDrivers")
open("src/hooks/useDrivers.ts", "w").write(content)

# 3. Settings.tsx
content = open("src/pages/Settings.tsx").read()
content = content.replace("disabledDrivers", "activeExternalDrivers")
content = content.replace("Settings as SettingsIcon,", "Database, Settings as SettingsIcon,")

old_map = """                    {allDrivers.map((driver: PluginManifest) => {
                      // Only allow toggling non-built-in plugins, or allow all? Let's allow all for now.
                      // Built-ins can be toggled too, but maybe warn? Let's just allow toggling.
                      const isEnabled = !(settings.activeExternalDrivers || []).includes(driver.id);
                      return (
                        <div key={driver.id} className="flex items-center justify-between p-3 rounded-lg border border-surface-tertiary bg-surface-secondary">
                          <div>
                            <div className="text-sm font-medium text-primary">{driver.name}</div>
                            <div className="text-xs text-secondary">{driver.description} (v{driver.version})</div>
                          </div>
                          <button
                            onClick={() => {
                              const disabled = settings.activeExternalDrivers || [];
                              if (isEnabled) {
                                updateSetting("activeExternalDrivers", [...disabled, driver.id]);
                              } else {
                                updateSetting("activeExternalDrivers", disabled.filter(id => id !== driver.id));
                              }
                            }}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${isEnabled ? "bg-blue-600" : "bg-surface-tertiary"}`}
                          >
                            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? "translate-x-4" : "translate-x-0"}`} />
                          </button>
                        </div>
                      );
                    })}"""
new_map = """                    {allDrivers.map((driver: PluginManifest) => {
                      const isBuiltin = ["mysql", "postgres", "sqlite"].includes(driver.id);
                      const activeExt = settings.activeExternalDrivers || [];
                      const isEnabled = isBuiltin || activeExt.includes(driver.id);
                      
                      return (
                        <div key={driver.id} className={`flex items-center justify-between p-3 rounded-lg border border-surface-tertiary bg-surface-secondary ${isBuiltin ? "opacity-80" : ""}`}>
                          <div>
                            <div className="text-sm font-medium text-primary flex items-center gap-2">
                                {driver.name}
                                {isBuiltin && <span className="text-[10px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded uppercase">Built-in</span>}
                            </div>
                            <div className="text-xs text-secondary">{driver.description} (v{driver.version})</div>
                          </div>
                          <button
                            onClick={() => {
                              if (isBuiltin) return;
                              if (isEnabled) {
                                updateSetting("activeExternalDrivers", activeExt.filter(id => id !== driver.id));
                              } else {
                                updateSetting("activeExternalDrivers", [...activeExt, driver.id]);
                              }
                            }}
                            disabled={isBuiltin}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${isEnabled ? "bg-blue-600" : "bg-surface-tertiary"} ${isBuiltin ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? "translate-x-4" : "translate-x-0"}`} />
                          </button>
                        </div>
                      );
                    })}"""

# Note: The old_map from earlier regex might have different spacing or let's just use string replace carefully
# First, let's read Settings.tsx and replace it reliably
with open('src/pages/Settings.tsx', 'w') as f:
    f.write(content)
