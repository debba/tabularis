use axum::{
    http::{Request, StatusCode},
    middleware,
    routing::{get, post},
    Router,
};
use tauri::AppHandle;
use tower_http::cors::{Any, CorsLayer};

use super::{
    access::{
        disconnect_handler, heartbeat_handler, is_public_path, is_valid_token,
        request_access_handler, request_status_handler, session_status_handler, AccessControlState,
    },
    handler::invoke_handler,
    static_files::static_handler,
};

#[derive(Clone)]
pub struct AppState {
    pub app: AppHandle,
    pub access: AccessControlState,
}

pub fn build_router(app: AppHandle, access: AccessControlState) -> Router {
    let state = AppState {
        app: app.clone(),
        access: access.clone(),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build auth middleware as a closure capturing AccessControlState
    let access_mw = access;
    let auth_layer = middleware::from_fn(move |req: Request<axum::body::Body>, next: middleware::Next| {
        let access_mw = access_mw.clone();
        async move {
            if is_public_path(req.uri().path()) {
                return Ok(next.run(req).await);
            }

            let token = req
                .headers()
                .get("Authorization")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.strip_prefix("Bearer "))
                .map(|s| s.to_string());

            match token {
                Some(t) if is_valid_token(&access_mw, &t) => Ok(next.run(req).await),
                _ => Err(StatusCode::UNAUTHORIZED),
            }
        }
    });

    Router::new()
        .route("/api/invoke", post(invoke_handler))
        .route("/api/heartbeat", post(heartbeat_handler))
        .route("/api/disconnect", post(disconnect_handler))
        .route("/api/request-access", post(request_access_handler))
        .route("/api/request-status/{id}", get(request_status_handler))
        .route("/api/session-status", get(session_status_handler))
        .fallback(get(static_handler))
        .layer(auth_layer)
        .layer(cors)
        .with_state(state)
}
