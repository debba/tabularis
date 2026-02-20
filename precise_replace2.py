import sys

def replace_all2():
    with open('src-tauri/src/commands.rs', 'r') as f:
        content = f.read()

    # list_databases
    old20 = """pub async fn list_databases<R: Runtime>(
    app: AppHandle<R>,
    params: ConnectionParams,
) -> Result<Vec<String>, String> {
    log::info!("Listing databases for params: {:?}", params);

    let expanded_params = expand_ssh_connection_params(&app, &params).await?;
    let resolved_params = resolve_connection_params(&expanded_params)?;

    // Handle database discovery internally based on the driver
    match resolved_params.driver.as_str() {
        "mysql" => {
            let mut conn_params = resolved_params.clone();
            // MySQL requires connecting to a specific database, information_schema is a safe default
            conn_params.database = "information_schema".to_string();
            mysql::get_databases(&conn_params).await
        }
        "postgres" => {
            let mut conn_params = resolved_params.clone();
            // Connect to default 'postgres' database to list all databases
            conn_params.database = "postgres".to_string();
            postgres::get_databases(&conn_params).await
        }
        "sqlite" => {
            // SQLite is file-based, there are no databases to list
            Ok(vec![])
        }
        _ => Err("Unsupported driver".into()),
    }
}"""
    new20 = """pub async fn list_databases<R: Runtime>(
    app: AppHandle<R>,
    params: ConnectionParams,
) -> Result<Vec<String>, String> {
    log::info!("Listing databases for params: {:?}", params);

    let expanded_params = expand_ssh_connection_params(&app, &params).await?;
    let resolved_params = resolve_connection_params(&expanded_params)?;

    let drv = driver_for(&resolved_params.driver).await?;
    drv.get_databases(&resolved_params).await
}"""
    content = content.replace(old20, new20)

    # get_data_types
    old21 = """pub async fn get_data_types(driver: String) -> crate::models::DataTypeRegistry {
    let types = match driver.as_str() {
        "mysql" => crate::drivers::mysql::types::get_data_types(),
        "postgres" => crate::drivers::postgres::types::get_data_types(),
        "sqlite" => crate::drivers::sqlite::types::get_data_types(),
        _ => {
            log::warn!("Unknown driver: {}, returning empty type list", driver);
            vec![]
        }
    };
    crate::models::DataTypeRegistry { driver, types }
}"""
    new21 = """pub async fn get_data_types(driver: String) -> crate::models::DataTypeRegistry {
    let types = match crate::drivers::registry::get_driver(&driver).await {
        Some(drv) => drv.get_data_types(),
        None => {
            log::warn!("Unknown driver: {}, returning empty type list", driver);
            vec![]
        }
    };
    crate::models::DataTypeRegistry { driver, types }
}"""
    content = content.replace(old21, new21)

    # build_connection_url
    old22 = """pub fn build_connection_url(params: &ConnectionParams) -> Result<String, String> {
    match params.driver.as_str() {
        "mysql" => {
            let user = encode(params.username.as_deref().unwrap_or_default());
            let pass = encode(params.password.as_deref().unwrap_or_default());
            Ok(format!(
                "mysql://{}:{}@{}:{}/{}",
                user,
                pass,
                params.host.as_deref().unwrap_or("localhost"),
                params.port.unwrap_or(DEFAULT_MYSQL_PORT),
                params.database
            ))
        }
        "postgres" => {
            let user = encode(params.username.as_deref().unwrap_or_default());
            let pass = encode(params.password.as_deref().unwrap_or_default());
            Ok(format!(
                "postgres://{}:{}@{}:{}/{}",
                user,
                pass,
                params.host.as_deref().unwrap_or("localhost"),
                params.port.unwrap_or(DEFAULT_POSTGRES_PORT),
                params.database
            ))
        }
        "sqlite" => Ok(format!("sqlite://{}", params.database)),
        _ => Err("Unsupported driver".to_string()),
    }
}"""
    # Wait build_connection_url becomes async now!
    new22 = """pub async fn build_connection_url(params: &ConnectionParams) -> Result<String, String> {
    let drv = driver_for(&params.driver).await?;
    drv.build_connection_url(params)
}"""
    content = content.replace(old22, new22)

    # test_connection calls build_connection_url
    old23 = """let url = build_connection_url(&resolved_params)?;"""
    new23 = """let url = build_connection_url(&resolved_params).await?;"""
    content = content.replace(old23, new23)
    
    # get_registered_drivers command
    if "get_registered_drivers" not in content:
        content += """

#[tauri::command]
pub async fn get_registered_drivers() -> Vec<crate::drivers::driver_trait::PluginManifest> {
    crate::drivers::registry::list_drivers().await
}
"""

    with open('src-tauri/src/commands.rs', 'w') as f:
        f.write(content)

replace_all2()
