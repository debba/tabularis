pub mod access;
pub mod auth;
pub mod handler;
pub mod router;
pub mod static_files;
pub mod tunnel;

pub use access::AccessControlState;

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use tokio::task::JoinHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteControlConfig {
    pub enabled: bool,
    pub port: u16,
}

impl Default for RemoteControlConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            port: 4321,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteControlStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub url: Option<String>,
}

pub struct ServerHandle {
    inner: Arc<Mutex<Option<(JoinHandle<()>, u16)>>>,
}

impl ServerHandle {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(None)),
        }
    }

    pub fn is_running(&self) -> bool {
        self.inner.lock().unwrap().is_some()
    }

    pub fn port(&self) -> Option<u16> {
        self.inner.lock().unwrap().as_ref().map(|(_, p)| *p)
    }
}

impl Default for ServerHandle {
    fn default() -> Self {
        Self::new()
    }
}

/// Stop the remote control HTTP server.
pub fn stop(handle: &ServerHandle) {
    let mut guard = handle.inner.lock().unwrap();
    if let Some((join_handle, _)) = guard.take() {
        join_handle.abort();
    }
}

/// Start and register the handle.
pub async fn start_and_register(
    app: AppHandle,
    config: RemoteControlConfig,
    access: AccessControlState,
) -> Result<u16, String> {
    let handle = app.state::<ServerHandle>();

    // Stop existing server if running
    stop(&handle);

    let port = config.port;
    let router = router::build_router(app.clone(), access)
        .into_make_service_with_connect_info::<std::net::SocketAddr>();

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await
        .map_err(|e| format!("Failed to bind port {}: {}", port, e))?;

    let actual_port = listener.local_addr().map_err(|e| e.to_string())?.port();

    let join_handle = tokio::spawn(async move {
        axum::serve(listener, router)
            .await
            .expect("HTTP server error");
    });

    {
        let mut guard = handle.inner.lock().unwrap();
        *guard = Some((join_handle, actual_port));
    }

    log::info!("Remote Control server started on port {}", actual_port);
    Ok(actual_port)
}

/// Get the local network IP address (best guess).
pub fn get_local_ip() -> String {
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                return addr.ip().to_string();
            }
        }
    }
    "localhost".to_string()
}
