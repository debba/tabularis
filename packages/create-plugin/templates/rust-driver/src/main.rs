//! Entry point: read JSON-RPC lines from stdin, dispatch, write responses.
//
// Scaffolded utilities (`ConnectionParams`, `quote_identifier`, `paginate`,
// etc.) are unused until you wire them into your handlers. Remove the
// crate-level `allow(dead_code)` once you start using them — the compiler
// will then correctly flag code you forgot to reach.
#![allow(dead_code)]

use std::io::{self, BufRead, Write};

mod client;
mod error;
mod handlers;
mod models;
mod rpc;
mod utils;

fn main() {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut out = stdout.lock();

    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let response = rpc::handle_line(trimmed);
        let mut body = match serde_json::to_string(&response) {
            Ok(s) => s,
            Err(err) => format!(
                "{{\"jsonrpc\":\"2.0\",\"error\":{{\"code\":-32603,\"message\":\"serialization failed: {err}\"}},\"id\":null}}",
            ),
        };
        body.push('\n');
        if out.write_all(body.as_bytes()).is_err() {
            break;
        }
        let _ = out.flush();
    }
}
