pub mod ai;
pub mod commands;
pub mod config;
pub mod dump_commands; // Added
#[cfg(test)]
pub mod dump_commands_tests;
pub mod export;
pub mod keychain_utils;
pub mod log_commands;
pub mod logger;
pub mod mcp;
pub mod models;
pub mod paths; // Added
pub mod persistence;
pub mod pool_manager;
pub mod preferences;
pub mod saved_queries;
pub mod ssh_tunnel;
pub mod theme_commands;
pub mod theme_models;
pub mod updater;
pub mod drivers {
    pub mod common;
    pub mod mysql;
    pub mod postgres;
    pub mod sqlite;
}

use clap::Parser;
use logger::{create_log_buffer, init_logger, SharedLogBuffer};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;

static DEBUG_MODE: AtomicBool = AtomicBool::new(false);

// Global log buffer for capturing logs
static LOG_BUFFER: std::sync::OnceLock<SharedLogBuffer> = std::sync::OnceLock::new();

pub fn get_log_buffer() -> SharedLogBuffer {
    LOG_BUFFER
        .get()
        .expect("Log buffer not initialized")
        .clone()
}

#[tauri::command]
fn is_debug_mode() -> bool {
    DEBUG_MODE.load(Ordering::Relaxed)
}

#[tauri::command]
fn open_devtools(window: tauri::WebviewWindow) {
    window.open_devtools();
    log::info!("DevTools opened");
}

#[tauri::command]
fn close_devtools(window: tauri::WebviewWindow) {
    window.close_devtools();
    log::info!("DevTools closed");
}

#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
struct Args {
    /// Start in MCP Server mode (Model Context Protocol)
    #[arg(long)]
    mcp: bool,

    /// Enable debug logging (including sqlx queries)
    #[arg(long)]
    debug: bool,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Check for CLI args first
    // We use try_parse because on some platforms (like GUI launch) args might be weird
    // or Tauri might want to handle them. But for --mcp we need priority.
    let args = Args::try_parse().unwrap_or_else(|_| Args {
        mcp: false,
        debug: false,
    });

    if args.mcp {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
        rt.block_on(mcp::run_mcp_server());
        return;
    }

    // Configure log level based on debug flag
    // Default to Info level so users can see application logs
    let log_level = log::LevelFilter::Info;

    // Store debug flag in global state
    DEBUG_MODE.store(args.debug, Ordering::Relaxed);

    // Create and initialize log buffer - MUST be before sqlx to capture all logs
    let log_buffer = create_log_buffer(1000);
    LOG_BUFFER
        .set(log_buffer.clone())
        .expect("Failed to initialize log buffer");

    // Initialize custom logger that captures logs to buffer and prints to stderr
    init_logger(log_buffer.clone(), log_level);

    // Log startup message
    log::info!("Tabularis application starting...");
    if args.debug {
        log::info!("Debug mode enabled - verbose logging active");
    } else {
        log::info!("Debug mode disabled - standard logging active");
    }

    // Install default drivers for sqlx::Any
    sqlx::any::install_default_drivers();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(commands::QueryCancellationState::default())
        .manage(export::ExportCancellationState::default())
        .manage(dump_commands::DumpCancellationState::default())
        .manage(log_buffer)
        .setup(move |app| {
            // Open devtools automatically in debug mode
            if args.debug {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                    log::info!("DevTools opened (debug mode active)");
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            is_debug_mode,
            open_devtools,
            close_devtools,
            commands::test_connection,
            commands::list_databases,
            commands::save_connection,
            commands::delete_connection,
            commands::update_connection,
            commands::duplicate_connection,
            commands::get_connections,
            // SSH Connections
            commands::get_ssh_connections,
            commands::save_ssh_connection,
            commands::update_ssh_connection,
            commands::delete_ssh_connection,
            commands::test_ssh_connection,
            commands::get_tables,
            commands::get_columns,
            commands::get_foreign_keys,
            commands::get_indexes,
            commands::delete_record,
            commands::update_record,
            commands::insert_record,
            commands::execute_query,
            commands::cancel_query,
            commands::get_views,
            commands::get_view_definition,
            commands::create_view,
            commands::alter_view,
            commands::drop_view,
            commands::get_view_columns,
            commands::set_window_title,
            commands::open_er_diagram_window,
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
            config::delete_ai_key,
            config::check_ai_key,
            config::check_ai_key_status,
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
            commands::get_schema_snapshot,
            // Routines
            commands::get_routines,
            commands::get_routine_parameters,
            commands::get_routine_definition,
            // MCP
            mcp::install::get_mcp_status,
            mcp::install::install_mcp_config,
            // Themes
            theme_commands::get_all_themes,
            theme_commands::get_theme,
            theme_commands::save_custom_theme,
            theme_commands::delete_custom_theme,
            theme_commands::import_theme,
            theme_commands::export_theme,
            // Dump & Import
            dump_commands::dump_database,
            dump_commands::cancel_dump,
            dump_commands::import_database,
            dump_commands::cancel_import,
            dump_commands::cancel_dump,
            // Updater
            updater::check_for_updates,
            updater::download_and_install_update,
            // Logs
            log_commands::get_logs,
            log_commands::clear_logs,
            log_commands::get_log_settings,
            log_commands::set_log_enabled,
            log_commands::set_log_max_size,
            log_commands::export_logs,
            log_commands::test_log,
            // Preferences
            preferences::save_editor_preferences,
            preferences::load_editor_preferences,
            preferences::delete_editor_preferences,
            preferences::list_all_preferences,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
