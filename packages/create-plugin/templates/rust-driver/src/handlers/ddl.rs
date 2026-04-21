//! DDL generation + mutation.
//!
//! Tabularis generates SQL by calling these methods and may show the
//! result to the user before executing it. Leaving them unimplemented
//! simply hides the matching UI affordances.

use serde_json::Value;

use crate::rpc::not_implemented;

pub fn get_create_table_sql(id: Value, _params: &Value) -> Value {
    not_implemented(id, "get_create_table_sql")
}

pub fn get_add_column_sql(id: Value, _params: &Value) -> Value {
    not_implemented(id, "get_add_column_sql")
}

pub fn get_alter_column_sql(id: Value, _params: &Value) -> Value {
    not_implemented(id, "get_alter_column_sql")
}

pub fn get_create_index_sql(id: Value, _params: &Value) -> Value {
    not_implemented(id, "get_create_index_sql")
}

pub fn get_create_foreign_key_sql(id: Value, _params: &Value) -> Value {
    not_implemented(id, "get_create_foreign_key_sql")
}

pub fn drop_index(id: Value, _params: &Value) -> Value {
    not_implemented(id, "drop_index")
}

pub fn drop_foreign_key(id: Value, _params: &Value) -> Value {
    not_implemented(id, "drop_foreign_key")
}
