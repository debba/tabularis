use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
    Json,
};
use serde::{Deserialize, Serialize};

use super::router::AppState;

#[derive(Clone)]
pub struct AuthState {
    /// SHA-256 hex of the password, or None if no auth required.
    pub token_hash: Option<String>,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
}

/// Compute SHA-256 hex of a string using only std (no extra dep).
pub fn sha256_hex(input: &str) -> String {
    use std::fmt::Write;
    // Simple SHA-256 via a manual implementation would be complex;
    // instead we iterate bytes with a basic digest.
    // Since we already have openssl in deps, use that.
    use openssl::sha::sha256;
    let digest = sha256(input.as_bytes());
    let mut s = String::with_capacity(64);
    for byte in &digest {
        write!(s, "{:02x}", byte).unwrap();
    }
    s
}

/// Axum middleware: checks Authorization header if auth is configured.
pub async fn auth_middleware(
    State(auth): State<AuthState>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // No auth configured → pass through
    let Some(expected_hash) = &auth.token_hash else {
        return Ok(next.run(req).await);
    };

    // Allow the login endpoint without auth
    if req.uri().path() == "/api/auth" {
        return Ok(next.run(req).await);
    }

    // Check Authorization: Bearer <token>
    let token = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "));

    match token {
        Some(t) if &sha256_hex(t) == expected_hash => Ok(next.run(req).await),
        _ => Err(StatusCode::UNAUTHORIZED),
    }
}

/// POST /api/auth — accepts password, returns a token (just the password itself as token).
/// The client should store it and send as Bearer.
pub async fn login_handler(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, StatusCode> {
    let auth = &state.auth;
    let Some(expected_hash) = &auth.token_hash else {
        // No auth configured, return a dummy token
        return Ok(Json(LoginResponse {
            token: "no-auth".to_string(),
        }));
    };

    if &sha256_hex(&body.password) == expected_hash {
        // Return the password itself as the token (client will hash when comparing)
        // Actually: the token IS the password, client sends it as Bearer,
        // we hash it server-side for comparison.
        Ok(Json(LoginResponse {
            token: body.password,
        }))
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}
