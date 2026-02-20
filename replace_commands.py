import re

content = open("src-tauri/src/commands.rs").read()

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

# get_schemas
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{[^{}]*?mysql::get_schemas[^{}]*?postgres::get_schemas[^{}]*?sqlite::get_schemas[^{}]*?\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_schemas(&params).await',
    content
)

# get_routines
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{[^{}]*?mysql::get_routines[^{}]*?postgres::get_routines[^{}]*?sqlite::get_routines[^{}]*?\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_routines(&params, schema.as_deref()).await',
    content
)

# get_routine_parameters
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{[^{}]*?mysql::get_routine_parameters[^{}]*?postgres::get_routine_parameters[^{}]*?\}\s*"sqlite" => sqlite::get_routine_parameters[^{}]*?\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_routine_parameters(&params, &routine_name, schema.as_deref()).await',
    content
)

# get_routine_definition
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{[^{}]*?mysql::get_routine_definition[^{}]*?postgres::get_routine_definition[^{}]*?\}\s*"sqlite" => sqlite::get_routine_definition[^{}]*?\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_routine_definition(&params, &routine_name, &routine_type, schema.as_deref()).await',
    content
)

# get_schema_snapshot
content = re.sub(
    r'let driver = saved_conn\.params\.driver\.clone\(\);\s*let pg_schema = schema\.as_deref\(\)\.unwrap_or\("public"\);\s*// 1\. Get Tables\s*let tables = match driver\.as_str\(\) \{[\s\S]*?\}[\s\S]*?// 2\. Fetch ALL columns and foreign keys in batch[\s\S]*?let result = match driver\.as_str\(\) \{[\s\S]*?_ => return Err\("Unsupported driver"\.into\(\)\),\s*\};\s*Ok\(result\)',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_schema_snapshot(&params, schema.as_deref()).await',
    content
)

# get_tables
content = re.sub(
    r'let result = match saved_conn\.params\.driver\.as_str\(\) \{[^{}]*?mysql::get_tables[^{}]*?postgres::get_tables[^{}]*?sqlite::get_tables[^{}]*?\};\s*result',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_tables(&params, schema.as_deref()).await',
    content
)

# get_columns
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{[^{}]*?mysql::get_columns[^{}]*?postgres::get_columns[^{}]*?\}\s*"sqlite" => sqlite::get_columns[^{}]*?\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_columns(&params, &table_name, schema.as_deref()).await',
    content
)

# get_foreign_keys
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{[^{}]*?mysql::get_foreign_keys[^{}]*?postgres::get_foreign_keys[^{}]*?\}\s*"sqlite" => sqlite::get_foreign_keys[^{}]*?\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_foreign_keys(&params, &table_name, schema.as_deref()).await',
    content
)

# get_indexes
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{[^{}]*?mysql::get_indexes[^{}]*?postgres::get_indexes[^{}]*?\}\s*"sqlite" => sqlite::get_indexes[^{}]*?\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_indexes(&params, &table_name, schema.as_deref()).await',
    content
)

# delete_record
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{[^{}]*?mysql::delete_record[^{}]*?postgres::delete_record[^{}]*?\}\s*"sqlite" => sqlite::delete_record[^{}]*?\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.delete_record(&params, &table, &pk_col, pk_val, schema.as_deref()).await',
    content
)

# update_record
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{[^{}]*?mysql::update_record[^{}]*?\}[^{}]*?postgres::update_record[^{}]*?\}[^{}]*?sqlite::update_record[^{}]*?\}[^{}]*?\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.update_record(&params, &table, &pk_col, pk_val, &col_name, new_val, schema.as_deref()).await',
    content
)

# insert_record
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{[^{}]*?mysql::insert_record[^{}]*?postgres::insert_record[^{}]*?\}\s*"sqlite" => sqlite::insert_record[^{}]*?\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.insert_record(&params, &table, data, schema.as_deref()).await',
    content
)

# execute_query
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{[^{}]*?mysql::execute_query[^{}]*?\}[^{}]*?postgres::execute_query[^{}]*?\}[^{}]*?sqlite::execute_query[^{}]*?\}[^{}]*?\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n        drv.execute_query(&params, &sanitized_query, limit, page.unwrap_or(1), schema.as_deref()).await',
    content
)

# get_views
content = re.sub(
    r'let result = match saved_conn\.params\.driver\.as_str\(\) \{[^{}]*?mysql::get_views[^{}]*?postgres::get_views[^{}]*?sqlite::get_views[^{}]*?\};\s*result',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_views(&params, schema.as_deref()).await',
    content
)

# get_view_definition
content = re.sub(
    r'let result = match saved_conn\.params\.driver\.as_str\(\) \{[^{}]*?mysql::get_view_definition[^{}]*?postgres::get_view_definition[^{}]*?\}\s*"sqlite" => sqlite::get_view_definition[^{}]*?\};\s*result',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_view_definition(&params, &view_name, schema.as_deref()).await',
    content
)

# create_view
content = re.sub(
    r'let result = match saved_conn\.params\.driver\.as_str\(\) \{[^{}]*?mysql::create_view[^{}]*?postgres::create_view[^{}]*?\}\s*"sqlite" => sqlite::create_view[^{}]*?\};\s*result',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.create_view(&params, &view_name, &definition, schema.as_deref()).await',
    content
)

# alter_view
content = re.sub(
    r'let result = match saved_conn\.params\.driver\.as_str\(\) \{[^{}]*?mysql::alter_view[^{}]*?postgres::alter_view[^{}]*?\}\s*"sqlite" => sqlite::alter_view[^{}]*?\};\s*result',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.alter_view(&params, &view_name, &definition, schema.as_deref()).await',
    content
)

# drop_view
content = re.sub(
    r'let result = match saved_conn\.params\.driver\.as_str\(\) \{[^{}]*?mysql::drop_view[^{}]*?postgres::drop_view[^{}]*?sqlite::drop_view[^{}]*?\};\s*result',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.drop_view(&params, &view_name, schema.as_deref()).await',
    content
)

# get_view_columns
content = re.sub(
    r'let result = match saved_conn\.params\.driver\.as_str\(\) \{[^{}]*?mysql::get_view_columns[^{}]*?postgres::get_view_columns[^{}]*?\}\s*"sqlite" => sqlite::get_view_columns[^{}]*?\};\s*result',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_view_columns(&params, &view_name, schema.as_deref()).await',
    content
)

open("src-tauri/src/commands.rs", "w").write(content)
