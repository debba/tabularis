import re

content = open("src/pages/Settings.tsx").read()

if 'import { useDrivers }' not in content:
    content = content.replace('import { getProviderLabel } from "../utils/settingsUI";', 'import { getProviderLabel } from "../utils/settingsUI";\nimport { useDrivers } from "../hooks/useDrivers";')

if 'const { drivers } = useDrivers();' not in content:
    content = content.replace('const { settings, updateSetting } = useSettings();', 'const { settings, updateSetting } = useSettings();\n  const { drivers } = useDrivers();', 1)

if '{t("settings.plugins")}' not in content:
    # Add plugins section to sidebar
    sidebar_old = """          <button
            onClick={() => setActiveTab("info")}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${activeTab === "info" ? "bg-surface-secondary text-primary" : "text-secondary hover:bg-surface-secondary hover:text-primary"}`}
          >
            {t("settings.info")}
          </button>"""
    sidebar_new = """          <button
            onClick={() => setActiveTab("plugins")}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${activeTab === "plugins" ? "bg-surface-secondary text-primary" : "text-secondary hover:bg-surface-secondary hover:text-primary"}`}
          >
            Plugins
          </button>
""" + sidebar_old
    content = content.replace(sidebar_old, sidebar_new)

    # Add plugins content panel
    plugins_content = """        {activeTab === "plugins" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-primary mb-4">Plugins</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">
                    Database Drivers
                  </label>
                  <p className="text-xs text-muted mb-4">
                    Enable or disable third-party database drivers.
                  </p>
                  
                  <div className="space-y-3">
                    {drivers.map(driver => {
                      // Only allow toggling non-built-in plugins, or allow all? Let's allow all for now.
                      // Built-ins can be toggled too, but maybe warn? Let's just allow toggling.
                      const isEnabled = !(settings.disabledDrivers || []).includes(driver.id);
                      return (
                        <div key={driver.id} className="flex items-center justify-between p-3 rounded-lg border border-surface-tertiary bg-surface-secondary">
                          <div>
                            <div className="text-sm font-medium text-primary">{driver.name}</div>
                            <div className="text-xs text-secondary">{driver.description} (v{driver.version})</div>
                          </div>
                          <button
                            onClick={() => {
                              const disabled = settings.disabledDrivers || [];
                              if (isEnabled) {
                                updateSetting("disabledDrivers", [...disabled, driver.id]);
                              } else {
                                updateSetting("disabledDrivers", disabled.filter(id => id !== driver.id));
                              }
                            }}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${isEnabled ? "bg-blue-600" : "bg-surface-tertiary"}`}
                          >
                            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? "translate-x-4" : "translate-x-0"}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}"""
    
    content = content.replace('        {activeTab === "info" && (', plugins_content + '\n\n        {activeTab === "info" && (')

with open('src/pages/Settings.tsx', 'w') as f:
    f.write(content)
