content = open("src/pages/Settings.tsx").read()

import re
old_regex = r'\{allDrivers\.map\(\(driver: PluginManifest\) => \{[\s\S]*?\}\)\}'

new_map = """{allDrivers.map((driver: PluginManifest) => {
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
                    
content = re.sub(old_regex, new_map, content)

open("src/pages/Settings.tsx", "w").write(content)
