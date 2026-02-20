import re

content = open("src-tauri/src/commands.rs").read()

old = """/// Builds a connection URL for a database driver.
/// This is a pure function that can be tested without a database connection.
#[inline]
pub fn build_connection_url(params: &ConnectionParams) -> Result<String, String> {"""

new = """/// Builds a connection URL for a database driver.
pub async fn build_connection_url(params: &ConnectionParams) -> Result<String, String> {"""

content = content.replace(old, new)

old_body = """    let user = encode(params.username.as_deref().unwrap_or_default());
    let pass = encode(params.password.as_deref().unwrap_or_default());
    let host = params.host.as_deref().unwrap_or("localhost");

    match params.driver.as_str() {
        "sqlite" => Ok(format!("sqlite://{}", params.database)),
        "postgres" => Ok(format!(
            "postgres://{}:{}@{}:{}/{}",
            user,
            pass,
            host,
            params.port.unwrap_or(DEFAULT_POSTGRES_PORT),
            params.database
        )),
        "mysql" => Ok(format!(
            "mysql://{}:{}@{}:{}/{}",
            user,
            pass,
            host,
            params.port.unwrap_or(DEFAULT_MYSQL_PORT),
            params.database
        )),
        _ => Err("Unsupported driver".to_string()),
    }"""

new_body = """    let drv = driver_for(&params.driver).await?;
    drv.build_connection_url(params)"""

content = content.replace(old_body, new_body)

open("src-tauri/src/commands.rs", "w").write(content)
