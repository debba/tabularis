import re

content = open("src-tauri/src/config.rs").read()

# Add disabled_drivers field
old_struct = """    pub schema_preferences: Option<HashMap<String, String>>,
    pub selected_schemas: Option<HashMap<String, Vec<String>>>,
    pub max_blob_size: Option<u64>,
}"""
new_struct = """    pub schema_preferences: Option<HashMap<String, String>>,
    pub selected_schemas: Option<HashMap<String, Vec<String>>>,
    pub max_blob_size: Option<u64>,
    pub disabled_drivers: Option<Vec<String>>,
}"""
content = content.replace(old_struct, new_struct)

# Add to merge logic in save_config
old_merge = """        if config.max_blob_size.is_some() {
            existing_config.max_blob_size = config.max_blob_size;
        }"""
new_merge = """        if config.max_blob_size.is_some() {
            existing_config.max_blob_size = config.max_blob_size;
        }
        if config.disabled_drivers.is_some() {
            existing_config.disabled_drivers = config.disabled_drivers;
        }"""
content = content.replace(old_merge, new_merge)

open("src-tauri/src/config.rs", "w").write(content)
