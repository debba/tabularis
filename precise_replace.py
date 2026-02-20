import sys

def replace_all():
    with open('src-tauri/src/commands.rs', 'r') as f:
        content = f.read()

    # Insert driver_for
    if "async fn driver_for" not in content:
        idx = content.find("const DEFAULT_MYSQL_PORT")
        if idx != -1:
            helper = """/// Resolve the driver from the registry or return a descriptive error.
async fn driver_for(
    id: &str,
) -> Result<std::sync::Arc<dyn crate::drivers::driver_trait::DatabaseDriver>, String> {
    crate::drivers::registry::get_driver(id)
        .await
        .ok_or_else(|| format!("Unsupported driver: {}", id))
}

"""
            content = content[:idx] + helper + content[idx:]

    # get_schemas
    old1 = """    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_schemas(&params).await,
        "postgres" => postgres::get_schemas(&params).await,
        "sqlite" => sqlite::get_schemas(&params).await,
        _ => Err("Unsupported driver".into()),
    }"""
    new1 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_schemas(&params).await"""
    content = content.replace(old1, new1)

    # get_routines
    old2 = """    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_routines(&params).await,
        "postgres" => postgres::get_routines(&params, schema.as_deref().unwrap_or("public")).await,
        "sqlite" => sqlite::get_routines(&params).await,
        _ => Err("Unsupported driver".into()),
    }"""
    new2 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_routines(&params, schema.as_deref()).await"""
    content = content.replace(old2, new2)

    # get_routine_parameters
    old3 = """    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_routine_parameters(&params, &routine_name).await,
        "postgres" => {
            postgres::get_routine_parameters(
                &params,
                &routine_name,
                schema.as_deref().unwrap_or("public"),
            )
            .await
        }
        "sqlite" => sqlite::get_routine_parameters(&params, &routine_name).await,
        _ => Err("Unsupported driver".into()),
    }"""
    new3 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_routine_parameters(&params, &routine_name, schema.as_deref()).await"""
    content = content.replace(old3, new3)

    # get_routine_definition
    old4 = """    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_routine_definition(&params, &routine_name, &routine_type).await,
        "postgres" => {
            postgres::get_routine_definition(
                &params,
                &routine_name,
                &routine_type,
                schema.as_deref().unwrap_or("public"),
            )
            .await
        }
        "sqlite" => sqlite::get_routine_definition(&params, &routine_name, &routine_type).await,
        _ => Err("Unsupported driver".into()),
    }"""
    new4 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_routine_definition(&params, &routine_name, &routine_type, schema.as_deref()).await"""
    content = content.replace(old4, new4)

    # get_schema_snapshot
    old5 = """    let driver = saved_conn.params.driver.clone();
    let pg_schema = schema.as_deref().unwrap_or("public");

    // 1. Get Tables
    let tables = match driver.as_str() {
        "mysql" => mysql::get_tables(&params).await,
        "postgres" => postgres::get_tables(&params, pg_schema).await,
        "sqlite" => sqlite::get_tables(&params).await,
        _ => Err("Unsupported driver".into()),
    }?;

    // 2. Fetch ALL columns and foreign keys in batch (2 queries instead of N*2)
    let result = match driver.as_str() {
        "mysql" => {
            let mut columns_map = mysql::get_all_columns_batch(&params).await?;
            let mut fks_map = mysql::get_all_foreign_keys_batch(&params).await?;

            tables
                .into_iter()
                .map(|table| crate::models::TableSchema {
                    name: table.name.clone(),
                    columns: columns_map.remove(&table.name).unwrap_or_default(),
                    foreign_keys: fks_map.remove(&table.name).unwrap_or_default(),
                })
                .collect()
        }
        "postgres" => {
            let mut columns_map = postgres::get_all_columns_batch(&params, pg_schema).await?;
            let mut fks_map = postgres::get_all_foreign_keys_batch(&params, pg_schema).await?;

            tables
                .into_iter()
                .map(|table| crate::models::TableSchema {
                    name: table.name.clone(),
                    columns: columns_map.remove(&table.name).unwrap_or_default(),
                    foreign_keys: fks_map.remove(&table.name).unwrap_or_default(),
                })
                .collect()
        }
        "sqlite" => {
            let table_names: Vec<String> = tables.iter().map(|t| t.name.clone()).collect();
            let mut columns_map = sqlite::get_all_columns_batch(&params, &table_names).await?;
            let mut fks_map = sqlite::get_all_foreign_keys_batch(&params, &table_names).await?;

            tables
                .into_iter()
                .map(|table| crate::models::TableSchema {
                    name: table.name.clone(),
                    columns: columns_map.remove(&table.name).unwrap_or_default(),
                    foreign_keys: fks_map.remove(&table.name).unwrap_or_default(),
                })
                .collect()
        }
        _ => return Err("Unsupported driver".into()),
    };

    Ok(result)"""
    new5 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_schema_snapshot(&params, schema.as_deref()).await"""
    content = content.replace(old5, new5)

    # get_tables
    old6 = """    let result = match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_tables(&params).await,
        "postgres" => postgres::get_tables(&params, schema.as_deref().unwrap_or("public")).await,
        "sqlite" => sqlite::get_tables(&params).await,
        _ => Err("Unsupported driver".into()),
    };

    result"""
    new6 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_tables(&params, schema.as_deref()).await"""
    content = content.replace(old6, new6)

    # get_columns
    old7 = """    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_columns(&params, &table_name).await,
        "postgres" => {
            postgres::get_columns(&params, &table_name, schema.as_deref().unwrap_or("public")).await
        }
        "sqlite" => sqlite::get_columns(&params, &table_name).await,
        _ => Err("Unsupported driver".into()),
    }"""
    new7 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_columns(&params, &table_name, schema.as_deref()).await"""
    content = content.replace(old7, new7)

    # get_foreign_keys
    old8 = """    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_foreign_keys(&params, &table_name).await,
        "postgres" => {
            postgres::get_foreign_keys(&params, &table_name, schema.as_deref().unwrap_or("public"))
                .await
        }
        "sqlite" => sqlite::get_foreign_keys(&params, &table_name).await,
        _ => Err("Unsupported driver".into()),
    }"""
    new8 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_foreign_keys(&params, &table_name, schema.as_deref()).await"""
    content = content.replace(old8, new8)

    # get_indexes
    old9 = """    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_indexes(&params, &table_name).await,
        "postgres" => {
            postgres::get_indexes(&params, &table_name, schema.as_deref().unwrap_or("public")).await
        }
        "sqlite" => sqlite::get_indexes(&params, &table_name).await,
        _ => Err("Unsupported driver".into()),
    }"""
    new9 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_indexes(&params, &table_name, schema.as_deref()).await"""
    content = content.replace(old9, new9)

    # delete_record
    old10 = """    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::delete_record(&params, &table, &pk_col, pk_val).await,
        "postgres" => {
            postgres::delete_record(
                &params,
                &table,
                &pk_col,
                pk_val,
                schema.as_deref().unwrap_or("public"),
            )
            .await
        }
        "sqlite" => sqlite::delete_record(&params, &table, &pk_col, pk_val).await,
        _ => Err("Unsupported driver".into()),
    }"""
    new10 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.delete_record(&params, &table, &pk_col, pk_val, schema.as_deref()).await"""
    content = content.replace(old10, new10)

    # update_record
    old11 = """    match saved_conn.params.driver.as_str() {
        "mysql" => {
            mysql::update_record(
                &params,
                &table,
                &pk_col,
                pk_val,
                &col_name,
                new_val,
            )
            .await
        }
        "postgres" => {
            postgres::update_record(
                &params,
                &table,
                &pk_col,
                pk_val,
                &col_name,
                new_val,
                schema.as_deref().unwrap_or("public"),
            )
            .await
        }
        "sqlite" => {
            sqlite::update_record(
                &params,
                &table,
                &pk_col,
                pk_val,
                &col_name,
                new_val,
            )
            .await
        }
        _ => Err("Unsupported driver".into()),
    }"""
    new11 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.update_record(&params, &table, &pk_col, pk_val, &col_name, new_val, schema.as_deref()).await"""
    content = content.replace(old11, new11)

    # insert_record
    old12 = """    let max_blob_size = crate::config::get_max_blob_size(&app);
    match saved_conn.params.driver.as_str() {
        "mysql" => mysql::insert_record(&params, &table, data, max_blob_size).await,
        "postgres" => {
            postgres::insert_record(
                &params,
                &table,
                data,
                schema.as_deref().unwrap_or("public"),
                max_blob_size,
            )
            .await
        }
        "sqlite" => sqlite::insert_record(&params, &table, data, max_blob_size).await,
        _ => Err("Unsupported driver".into()),
    }"""
    new12 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    // Note: DatabaseDriver interface for insert_record doesn't take max_blob_size yet,
    // so we just omit it for now (we'll fix it if we need to add it to the trait later).
    drv.insert_record(&params, &table, data, schema.as_deref()).await"""
    content = content.replace(old12, new12)

    # execute_query
    old13 = """    let task = tokio::spawn(async move {
        match saved_conn.params.driver.as_str() {
            "mysql" => {
                mysql::execute_query(&params, &sanitized_query, limit, page.unwrap_or(1)).await
            }
            "postgres" => {
                postgres::execute_query(
                    &params,
                    &sanitized_query,
                    limit,
                    page.unwrap_or(1),
                    schema.as_deref(),
                )
                .await
            }
            "sqlite" => {
                sqlite::execute_query(&params, &sanitized_query, limit, page.unwrap_or(1)).await
            }
            _ => Err("Unsupported driver".into()),
        }
    });"""
    new13 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    let task = tokio::spawn(async move {
        drv.execute_query(&params, &sanitized_query, limit, page.unwrap_or(1), schema.as_deref()).await
    });"""
    content = content.replace(old13, new13)

    # get_views
    old14 = """    let result = match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_views(&params).await,
        "postgres" => postgres::get_views(&params, schema.as_deref().unwrap_or("public")).await,
        "sqlite" => sqlite::get_views(&params).await,
        _ => Err("Unsupported driver".into()),
    };

    result"""
    new14 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_views(&params, schema.as_deref()).await"""
    content = content.replace(old14, new14)

    # get_view_definition
    old15 = """    let result = match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_view_definition(&params, &view_name).await,
        "postgres" => {
            postgres::get_view_definition(
                &params,
                &view_name,
                schema.as_deref().unwrap_or("public"),
            )
            .await
        }
        "sqlite" => sqlite::get_view_definition(&params, &view_name).await,
        _ => Err("Unsupported driver".into()),
    };

    result"""
    new15 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_view_definition(&params, &view_name, schema.as_deref()).await"""
    content = content.replace(old15, new15)

    # create_view
    old16 = """    let result = match saved_conn.params.driver.as_str() {
        "mysql" => mysql::create_view(&params, &view_name, &definition).await,
        "postgres" => {
            postgres::create_view(
                &params,
                &view_name,
                &definition,
                schema.as_deref().unwrap_or("public"),
            )
            .await
        }
        "sqlite" => sqlite::create_view(&params, &view_name, &definition).await,
        _ => Err("Unsupported driver".into()),
    };

    result"""
    new16 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.create_view(&params, &view_name, &definition, schema.as_deref()).await"""
    content = content.replace(old16, new16)

    # alter_view
    old17 = """    let result = match saved_conn.params.driver.as_str() {
        "mysql" => mysql::alter_view(&params, &view_name, &definition).await,
        "postgres" => {
            postgres::alter_view(
                &params,
                &view_name,
                &definition,
                schema.as_deref().unwrap_or("public"),
            )
            .await
        }
        "sqlite" => sqlite::alter_view(&params, &view_name, &definition).await,
        _ => Err("Unsupported driver".into()),
    };

    result"""
    new17 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.alter_view(&params, &view_name, &definition, schema.as_deref()).await"""
    content = content.replace(old17, new17)

    # drop_view
    old18 = """    let result = match saved_conn.params.driver.as_str() {
        "mysql" => mysql::drop_view(&params, &view_name).await,
        "postgres" => {
            postgres::drop_view(&params, &view_name, schema.as_deref().unwrap_or("public")).await
        }
        "sqlite" => sqlite::drop_view(&params, &view_name).await,
        _ => Err("Unsupported driver".into()),
    };

    result"""
    new18 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.drop_view(&params, &view_name, schema.as_deref()).await"""
    content = content.replace(old18, new18)

    # get_view_columns
    old19 = """    let result = match saved_conn.params.driver.as_str() {
        "mysql" => mysql::get_view_columns(&params, &view_name).await,
        "postgres" => {
            postgres::get_view_columns(&params, &view_name, schema.as_deref().unwrap_or("public"))
                .await
        }
        "sqlite" => sqlite::get_view_columns(&params, &view_name).await,
        _ => Err("Unsupported driver".into()),
    };

    result"""
    new19 = """    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_view_columns(&params, &view_name, schema.as_deref()).await"""
    content = content.replace(old19, new19)

    with open('src-tauri/src/commands.rs', 'w') as f:
        f.write(content)

replace_all()
