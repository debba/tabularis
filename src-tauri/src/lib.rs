pub mod commands;
pub mod ssh_tunnel;
pub mod models;
pub mod drivers {
    pub mod mysql;
    pub mod postgres;
    pub mod sqlite;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Install default drivers for sqlx::Any
    sqlx::any::install_default_drivers();

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(commands::QueryCancellationState::default())
        .invoke_handler(tauri::generate_handler![
            commands::test_connection,
            commands::save_connection,
            commands::delete_connection,
            commands::update_connection,
            commands::get_connections,
            commands::get_tables,
            commands::get_columns,
            commands::delete_record,
            commands::update_record,
            commands::insert_record,
            commands::execute_query,
            commands::cancel_query
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
