import re

content = open("src-tauri/src/config.rs").read()
content = content.replace("pub disabled_drivers: Option<Vec<String>>", "pub active_external_drivers: Option<Vec<String>>")
content = content.replace("existing_config.disabled_drivers = config.disabled_drivers;", "existing_config.active_external_drivers = config.active_external_drivers;")
content = content.replace("if config.disabled_drivers.is_some() {", "if config.active_external_drivers.is_some() {")

open("src-tauri/src/config.rs", "w").write(content)
