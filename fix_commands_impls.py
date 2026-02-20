import re

content = open("src-tauri/src/commands.rs").read()

# fix insert_record call in commands.rs
old_insert = """    let drv = driver_for(&saved_conn.params.driver).await?;
    // Note: DatabaseDriver interface for insert_record doesn't take max_blob_size yet,
    // so we just omit it for now (we'll fix it if we need to add it to the trait later).
    drv.insert_record(&params, &table, data, schema.as_deref()).await"""
new_insert = """    let max_blob_size = crate::config::get_max_blob_size(&app);
    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.insert_record(&params, &table, data, schema.as_deref(), max_blob_size).await"""
content = content.replace(old_insert, new_insert)

# fix update_record call in commands.rs
old_update = """    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.update_record(&params, &table, &pk_col, pk_val, &col_name, new_val, schema.as_deref()).await"""
new_update = """    let max_blob_size = crate::config::get_max_blob_size(&app);
    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.update_record(&params, &table, &pk_col, pk_val, &col_name, new_val, schema.as_deref(), max_blob_size).await"""
content = content.replace(old_update, new_update)

open("src-tauri/src/commands.rs", "w").write(content)
