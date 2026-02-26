use axum::{
    body::Body,
    http::{header, Response, StatusCode},
    response::IntoResponse,
};
use include_dir::{include_dir, Dir};

// Embed the frontend dist at compile time.
// The dist is built from the project root's `dist/` directory.
static FRONTEND: Dir<'static> = include_dir!("$CARGO_MANIFEST_DIR/../dist");

pub async fn static_handler(uri: axum::http::Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');

    // Try to serve the exact file
    if let Some(file) = FRONTEND.get_file(path) {
        let mime = mime_guess::from_path(path)
            .first_or_octet_stream()
            .to_string();
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, mime)
            .body(Body::from(file.contents()))
            .unwrap();
    }

    // SPA fallback: serve index.html for any unknown path
    if let Some(index) = FRONTEND.get_file("index.html") {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
            .body(Body::from(index.contents()))
            .unwrap();
    }

    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(Body::from("Not found"))
        .unwrap()
}
