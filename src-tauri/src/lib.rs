pub mod commands;
pub mod config;
pub mod ai;
pub mod export;
pub mod keychain_utils;
pub mod models;
pub mod persistence;
pub mod paths; // Added
pub mod pool_manager;
pub mod saved_queries;
pub mod ssh_tunnel;
pub mod mcp;
pub mod drivers {
    pub mod common;
    pub mod mysql;
    pub mod postgres;
    pub mod sqlite;
}

use clap::Parser;

#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
struct Args {
    /// Start in MCP Server mode (Model Context Protocol)
    #[arg(long)]
    mcp: bool,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Check for CLI args first
    // We use try_parse because on some platforms (like GUI launch) args might be weird
    // or Tauri might want to handle them. But for --mcp we need priority.
    let args = Args::try_parse().unwrap_or_else(|_| Args { mcp: false });

    if args.mcp {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
        rt.block_on(mcp::run_mcp_server());
        return;
    }

    // Install default drivers for sqlx::Any
    sqlx::any::install_default_drivers();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(commands::QueryCancellationState::default())
        .manage(export::ExportCancellationState::default())
        .invoke_handler(tauri::generate_handler![
            commands::test_connection,
            commands::save_connection,
            commands::delete_connection,
            commands::update_connection,
            commands::duplicate_connection,
            commands::get_connections,
            commands::get_tables,
            commands::get_columns,
            commands::get_foreign_keys,
            commands::get_indexes,
            commands::delete_record,
            commands::update_record,
            commands::insert_record,
            commands::execute_query,
            commands::cancel_query,
            commands::set_window_title,
            export::export_query_to_file,
            export::cancel_export,
            saved_queries::get_saved_queries,
            saved_queries::save_query,
            saved_queries::update_saved_query,
            saved_queries::delete_saved_query,
            // Config
            config::get_config,
            config::save_config,
            config::set_ai_key,
            config::check_ai_key,
            config::get_system_prompt,
            config::save_system_prompt,
            config::reset_system_prompt,
            config::get_explain_prompt,
            config::save_explain_prompt,
            config::reset_explain_prompt,
            // AI
            ai::generate_ai_query,
            ai::explain_ai_query,
            ai::get_ai_models,
            // MCP
            mcp::install::get_mcp_status,
            mcp::install::install_mcp_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
