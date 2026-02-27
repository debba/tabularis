use axum::{
    extract::{ConnectInfo, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use super::router::AppState;

/// Heartbeat timeout: session revoked after this many seconds with no heartbeat.
const HEARTBEAT_TIMEOUT_SECS: i64 = 90;
/// How often the background monitor checks for stale sessions.
const MONITOR_INTERVAL_SECS: u64 = 30;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RequestStatus {
    Pending,
    Approved,
    Denied,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingRequest {
    pub id: String,
    pub name: Option<String>,
    pub ip: String,
    pub status: RequestStatus,
    pub token: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub token: String,
    pub name: Option<String>,
    pub ip: String,
    pub connected_at: i64,
    pub last_heartbeat: i64,
    pub revoked: bool,
}

#[derive(Debug, Clone, Default)]
pub struct AccessControlState {
    pub requests: Arc<Mutex<HashMap<String, PendingRequest>>>,
    pub sessions: Arc<Mutex<HashMap<String, SessionInfo>>>,
}

// ── POST /api/request-access ──────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct RequestAccessBody {
    pub name: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestAccessResponse {
    pub request_id: String,
}

pub async fn request_access_handler(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<RequestAccessBody>,
) -> Result<Json<RequestAccessResponse>, StatusCode> {
    // X-Forwarded-For first (Cloudflare tunnel), fallback to TCP peer address
    let ip = headers
        .get("X-Forwarded-For")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| addr.ip().to_string());

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp();

    let request = PendingRequest {
        id: id.clone(),
        name: body.name.clone(),
        ip: ip.clone(),
        status: RequestStatus::Pending,
        token: None,
        created_at: now,
    };

    {
        let mut requests = state.access.requests.lock().unwrap();
        requests.insert(id.clone(), request);
    }

    let event_payload = serde_json::json!({
        "requestId": id,
        "name": body.name,
        "ip": ip,
    });

    if let Err(e) = state.app.emit("rc_new_request", event_payload) {
        log::error!("Failed to emit rc_new_request: {}", e);
    }

    Ok(Json(RequestAccessResponse { request_id: id }))
}

// ── GET /api/request-status/{id} ─────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestStatusResponse {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
}

pub async fn request_status_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<RequestStatusResponse>, StatusCode> {
    let requests = state.access.requests.lock().unwrap();
    let Some(req) = requests.get(&id) else {
        return Err(StatusCode::NOT_FOUND);
    };

    let response = match req.status {
        RequestStatus::Pending => RequestStatusResponse {
            status: "pending".to_string(),
            token: None,
        },
        RequestStatus::Approved => RequestStatusResponse {
            status: "approved".to_string(),
            token: req.token.clone(),
        },
        RequestStatus::Denied => RequestStatusResponse {
            status: "denied".to_string(),
            token: None,
        },
    };

    Ok(Json(response))
}

// ── GET /api/session-status ───────────────────────────────────────────────────

#[derive(Serialize)]
pub struct SessionStatusResponse {
    pub status: String,
}

pub async fn session_status_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Json<SessionStatusResponse> {
    let token = headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.to_string());

    let Some(token) = token else {
        return Json(SessionStatusResponse {
            status: "unknown".to_string(),
        });
    };

    let sessions = state.access.sessions.lock().unwrap();
    let status = match sessions.get(&token) {
        Some(s) if s.revoked => "revoked",
        Some(_) => "active",
        None => "unknown",
    };

    Json(SessionStatusResponse {
        status: status.to_string(),
    })
}

// ── POST /api/disconnect ──────────────────────────────────────────────────────

pub async fn disconnect_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> StatusCode {
    let token = headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.to_string());

    let Some(token) = token else {
        return StatusCode::UNAUTHORIZED;
    };

    let (name, ip) = {
        let mut sessions = state.access.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(&token) {
            let n = session.name.clone();
            let i = session.ip.clone();
            session.revoked = true;
            (n, i)
        } else {
            return StatusCode::NOT_FOUND;
        }
    };

    let _ = state.app.emit(
        "rc_session_disconnected",
        serde_json::json!({ "token": token, "name": name, "ip": ip }),
    );

    let display_name = name.as_deref().unwrap_or(&ip);
    log::info!("Session voluntarily disconnected: {}", display_name);
    StatusCode::OK
}

// ── POST /api/heartbeat ───────────────────────────────────────────────────────

pub async fn heartbeat_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> StatusCode {
    let token = headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.to_string());

    if let Some(token) = token {
        let mut sessions = state.access.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(&token) {
            if !session.revoked {
                session.last_heartbeat = Utc::now().timestamp();
            }
        }
    }

    StatusCode::OK
}

// ── Heartbeat monitor ─────────────────────────────────────────────────────────

/// Spawns a background task that auto-revokes sessions with stale heartbeats
/// and sends an OS notification + Tauri event for each disconnected session.
pub fn start_heartbeat_monitor(app: AppHandle, access: AccessControlState) {
    tokio::spawn(async move {
        let mut interval =
            tokio::time::interval(tokio::time::Duration::from_secs(MONITOR_INTERVAL_SECS));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            interval.tick().await;

            let now = Utc::now().timestamp();
            let mut timed_out: Vec<(String, Option<String>, String)> = Vec::new();

            {
                let mut sessions = access.sessions.lock().unwrap();
                for (token, session) in sessions.iter_mut() {
                    if !session.revoked
                        && now - session.last_heartbeat > HEARTBEAT_TIMEOUT_SECS
                    {
                        session.revoked = true;
                        timed_out.push((
                            token.clone(),
                            session.name.clone(),
                            session.ip.clone(),
                        ));
                    }
                }
            }

            for (token, name, ip) in timed_out {
                let display_name = name.as_deref().unwrap_or(&ip);

                // In-app event so the sessions tab can refresh and trigger JS notification
                let _ = app.emit(
                    "rc_session_disconnected",
                    serde_json::json!({ "token": token, "name": name, "ip": ip }),
                );

                log::info!("Session auto-revoked due to inactivity: {}", display_name);
            }
        }
    });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Returns true if the Bearer token is in an active (non-revoked) session.
pub fn is_valid_token(access: &AccessControlState, token: &str) -> bool {
    let sessions = access.sessions.lock().unwrap();
    matches!(sessions.get(token), Some(s) if !s.revoked)
}

/// Returns true if the request path is public (no auth required).
pub fn is_public_path(path: &str) -> bool {
    !path.starts_with("/api/")
        || path == "/api/request-access"
        || path.starts_with("/api/request-status/")
        || path == "/api/session-status"
}
