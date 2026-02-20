import re

content = open("src-tauri/src/commands.rs").read()

# Replace get_tables
content = re.sub(
    r'let result = match saved_conn\.params\.driver\.as_str\(\) \{\s*"mysql" => mysql::get_tables\(&params\)\.await,\s*"postgres" => postgres::get_tables\(&params, schema\.as_deref\(\)\.unwrap_or\("public"\)\)\.await,\s*"sqlite" => sqlite::get_tables\(&params\)\.await,\s*_ => Err\("Unsupported driver"\.into\(\)\),\s*\};\s*result',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_tables(&params, schema.as_deref()).await',
    content
)

# Replace get_columns
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{\s*"mysql" => mysql::get_columns\(&params, &table_name\)\.await,\s*"postgres" => \{\s*postgres::get_columns\(&params, &table_name, schema\.as_deref\(\)\.unwrap_or\("public"\)\)\.await\s*\}\s*"sqlite" => sqlite::get_columns\(&params, &table_name\)\.await,\s*_ => Err\("Unsupported driver"\.into\(\)\),\s*\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_columns(&params, &table_name, schema.as_deref()).await',
    content
)

# Replace get_foreign_keys
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{\s*"mysql" => mysql::get_foreign_keys\(&params, &table_name\)\.await,\s*"postgres" => \{\s*postgres::get_foreign_keys\(&params, &table_name, schema\.as_deref\(\)\.unwrap_or\("public"\)\)\s*\.await\s*\}\s*"sqlite" => sqlite::get_foreign_keys\(&params, &table_name\)\.await,\s*_ => Err\("Unsupported driver"\.into\(\)\),\s*\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_foreign_keys(&params, &table_name, schema.as_deref()).await',
    content
)

# Replace get_indexes
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{\s*"mysql" => mysql::get_indexes\(&params, &table_name\)\.await,\s*"postgres" => \{\s*postgres::get_indexes\(&params, &table_name, schema\.as_deref\(\)\.unwrap_or\("public"\)\)\.await\s*\}\s*"sqlite" => sqlite::get_indexes\(&params, &table_name\)\.await,\s*_ => Err\("Unsupported driver"\.into\(\)\),\s*\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.get_indexes(&params, &table_name, schema.as_deref()).await',
    content
)

# Replace delete_record
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{\s*"mysql" => mysql::delete_record\(&params, &table, &pk_col, pk_val\)\.await,\s*"postgres" => \{\s*postgres::delete_record\(\s*&params,\s*&table,\s*&pk_col,\s*pk_val,\s*schema\.as_deref\(\)\.unwrap_or\("public"\),\s*\)\s*\.await\s*\}\s*"sqlite" => sqlite::delete_record\(&params, &table, &pk_col, pk_val\)\.await,\s*_ => Err\("Unsupported driver"\.into\(\)\),\s*\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.delete_record(&params, &table, &pk_col, pk_val, schema.as_deref()).await',
    content
)

# Replace update_record
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{\s*"mysql" => \{\s*mysql::update_record\(\s*&params,\s*&table,\s*&pk_col,\s*pk_val,\s*&col_name,\s*new_val,\s*\)\s*\.await\s*\}\s*"postgres" => \{\s*postgres::update_record\(\s*&params,\s*&table,\s*&pk_col,\s*pk_val,\s*&col_name,\s*new_val,\s*schema\.as_deref\(\)\.unwrap_or\("public"\),\s*\)\s*\.await\s*\}\s*"sqlite" => \{\s*sqlite::update_record\(\s*&params,\s*&table,\s*&pk_col,\s*pk_val,\s*&col_name,\s*new_val,\s*\)\s*\.await\s*\}\s*_ => Err\("Unsupported driver"\.into\(\)\),\s*\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.update_record(&params, &table, &pk_col, pk_val, &col_name, new_val, schema.as_deref()).await',
    content
)

# Replace insert_record
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{\s*"mysql" => mysql::insert_record\(&params, &table, data, max_blob_size\)\.await,\s*"postgres" => \{\s*postgres::insert_record\(\s*&params,\s*&table,\s*data,\s*max_blob_size,\s*schema\.as_deref\(\)\.unwrap_or\("public"\),\s*\)\s*\.await\s*\}\s*"sqlite" => sqlite::insert_record\(&params, &table, data, max_blob_size\)\.await,\s*_ => Err\("Unsupported driver"\.into\(\)\),\s*\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n    drv.insert_record(&params, &table, data, schema.as_deref()).await',
    content
)


# Replace execute_query
content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{\s*"mysql" => \{\s*mysql::execute_query\(&params, &sanitized_query, limit, page\.unwrap_or\(1\)\)\.await\s*\}\s*"postgres" => \{\s*postgres::execute_query\(\s*&params,\s*&sanitized_query,\s*limit,\s*page\.unwrap_or\(1\),\s*schema\.as_deref\(\)\.unwrap_or\("public"\),\s*\)\s*\.await\s*\}\s*"sqlite" => \{\s*sqlite::execute_query\(&params, &sanitized_query, limit, page\.unwrap_or\(1\)\)\.await\s*\}\s*_ => Err\("Unsupported driver"\.into\(\)\),\s*\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n        drv.execute_query(&params, &sanitized_query, limit, page.unwrap_or(1), schema.as_deref()).await',
    content
)

# We need to wrap execute_query in tokio spawn according to the plan:
# The original code has:
# let task = tokio::spawn(async move {
#     match saved_conn.params.driver.as_str() { ... }
# });
# We just substituted the match block inside `let task = tokio::spawn(async move { ... });`
# Wait, driver_for(&saved_conn.params.driver).await? inside async move requires saved_conn to be moved or driver to be moved.
# Let's fix execute_query manually if needed. Let's see the context.

open("src-tauri/src/commands.rs", "w").write(content)
