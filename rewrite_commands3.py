import re

content = open("src-tauri/src/commands.rs").read()

content = re.sub(
    r'match saved_conn\.params\.driver\.as_str\(\) \{[\s\S]*?mysql::execute_query\(&params, &sanitized_query, limit, page\.unwrap_or\(1\)\)\.await[\s\S]*?postgres::execute_query\([\s\S]*?&params,[\s\S]*?&sanitized_query,[\s\S]*?limit,[\s\S]*?page\.unwrap_or\(1\),[\s\S]*?schema\.as_deref\(\),[\s\S]*?\)\s*\.await[\s\S]*?sqlite::execute_query\(&params, &sanitized_query, limit, page\.unwrap_or\(1\)\)\.await[\s\S]*?_ => Err\("Unsupported driver"\.into\(\)\),\s*\}',
    r'let drv = driver_for(&saved_conn.params.driver).await?;\n        drv.execute_query(&params, &sanitized_query, limit, page.unwrap_or(1), schema.as_deref()).await',
    content
)

open("src-tauri/src/commands.rs", "w").write(content)
