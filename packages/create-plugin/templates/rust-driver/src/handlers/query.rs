//! Connection and query execution.
//!
//! `test_connection` and `ping` return success unconditionally — this is
//! what lets the driver show up in the Tabularis connection picker right
//! after `just dev-install`. Replace with real checks before shipping.

use serde_json::{json, Value};

use crate::rpc::{not_implemented, ok_response};

pub fn test_connection(id: Value, _params: &Value) -> Value {
    // TODO: implement a real connectivity check (open a connection, run a
    // trivial query, close it).
    ok_response(id, json!({ "success": true }))
}

pub fn execute_query(id: Value, _params: &Value) -> Value {
    // TODO: run the SQL in params.query and return
    //   { columns: [string], rows: [[any]], total_count: number, execution_time_ms: number }
    not_implemented(id, "execute_query")
}

pub fn explain_query(id: Value, _params: &Value) -> Value {
    // TODO: return the same shape as execute_query but for EXPLAIN.
    not_implemented(id, "explain_query")
}
