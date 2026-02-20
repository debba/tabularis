import re

content = open("src-tauri/src/commands.rs").read()

# Add the driver_for helper function near the top after imports
if "async fn driver_for" not in content:
    imports_end = content.find("\n// Constants")
    if imports_end != -1:
        helper = """
/// Resolve the driver from the registry or return a descriptive error.
async fn driver_for(
    id: &str,
) -> Result<std::sync::Arc<dyn crate::drivers::driver_trait::DatabaseDriver>, String> {
    crate::drivers::registry::get_driver(id)
        .await
        .ok_or_else(|| format!("Unsupported driver: {}", id))
}
"""
        content = content[:imports_end] + helper + content[imports_end:]

# Replace get_schemas
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{\s*"mysql" => mysql::get_schemas\(&params\)\.await,\s*"postgres" => postgres::get_schemas\(&params\)\.await,\s*"sqlite" => sqlite::get_schemas\(&params\)\.await,\s*_ => Err\("Unsupported driver"\.into\(\)\),\s*\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_schemas(&params).await',
    content
)

# Replace get_routines
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{\s*"mysql" => mysql::get_routines\(&params\)\.await,\s*"postgres" => postgres::get_routines\(&params, schema\.as_deref\(\)\.unwrap_or\("public"\)\)\.await,\s*"sqlite" => sqlite::get_routines\(&params\)\.await,\s*_ => Err\("Unsupported driver"\.into\(\)\),\s*\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_routines(&params, schema.as_deref()).await',
    content
)

# Replace get_routine_parameters
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{\s*"mysql" => mysql::get_routine_parameters\(&params, &routine_name\)\.await,\s*"postgres" => \{\s*postgres::get_routine_parameters\(\s*&params,\s*&routine_name,\s*schema\.as_deref\(\)\.unwrap_or\("public"\),\s*\)\s*\.await\s*\}\s*"sqlite" => sqlite::get_routine_parameters\(&params, &routine_name\)\.await,\s*_ => Err\("Unsupported driver"\.into\(\)\),\s*\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_routine_parameters(&params, &routine_name, schema.as_deref()).await',
    content
)

# Replace get_routine_definition
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{\s*"mysql" => mysql::get_routine_definition\(&params, &routine_name, &routine_type\)\.await,\s*"postgres" => \{\s*postgres::get_routine_definition\(\s*&params,\s*&routine_name,\s*&routine_type,\s*schema\.as_deref\(\)\.unwrap_or\("public"\),\s*\)\s*\.await\s*\}\s*"sqlite" => sqlite::get_routine_definition\(&params, &routine_name, &routine_type\)\.await,\s*_ => Err\("Unsupported driver"\.into\(\)\),\s*\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_routine_definition(&params, &routine_name, &routine_type, schema.as_deref()).await',
    content
)

# Replace get_schema_snapshot
content = re.sub(
    r'let driver = saved_conn\.params\.driver\.clone\(\);\s*let pg_schema = schema\.as_deref\(\)\.unwrap_or\("public"\);\s*// 1\. Get Tables\s*let tables = match driver\.as_str\(\) \{\s*"mysql" => mysql::get_tables\(&params\)\.await,\s*"postgres" => postgres::get_tables\(&params, pg_schema\)\.await,\s*"sqlite" => sqlite::get_tables\(&params\)\.await,\s*_ => Err\("Unsupported driver"\.into\(\)\),\s*\}\?;\s*// 2\. Fetch ALL columns and foreign keys in batch \(2 queries instead of N\*2\)\s*let result = match driver\.as_str\(\) \{[\s\S]*?_ => return Err\("Unsupported driver"\.into\(\)\),\s*\};\s*Ok\(result\)',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_schema_snapshot(&params, schema.as_deref()).await',
    content
)

open("src-tauri/src/commands.rs", "w").write(content)
