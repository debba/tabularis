use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use tauri::AppHandle;
use tower_http::cors::{Any, CorsLayer};

use super::{
    auth::{auth_middleware, login_handler, AuthState},
    handler::invoke_handler,
    static_files::static_handler,
    RemoteControlConfig,
};

#[derive(Clone)]
pub struct AppState {
    pub app: AppHandle,
    pub auth: AuthState,
}

pub fn build_router(app: AppHandle, config: RemoteControlConfig) -> Router {
    let auth_state = AuthState {
        token_hash: config.token_hash.clone(),
    };

    let state = AppState {
        app: app.clone(),
        auth: auth_state.clone(),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/api/invoke", post(invoke_handler))
        .route("/api/auth", post(login_handler))
        .fallback(get(static_handler))
        .layer(middleware::from_fn_with_state(
            auth_state,
            auth_middleware,
        ))
        .layer(cors)
        .with_state(state)
}
