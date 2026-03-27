use std::{collections::HashMap, net::IpAddr};

use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use rust_decimal::Decimal;
use serde_json::Value as JsonValue;
use tokio_postgres::types::{FromSql, Type};
use uuid::Uuid;

use crate::drivers::common::encode_blob;

#[inline]
pub fn extract_or_null(ty: &Type, buf: &[u8]) -> JsonValue {
    match *ty {
        Type::BOOL => JsonValue::from(from_sql_or_none::<bool>(ty, buf)),
        Type::BYTEA => {
            JsonValue::from(from_sql_or_none::<Vec<u8>>(ty, buf).map(|b| encode_blob(&b)))
        }

        // numeric
        Type::CHAR => JsonValue::from(from_sql_or_none::<i8>(ty, buf)), // this mapped to `i8`
        Type::INT2 => JsonValue::from(from_sql_or_none::<i16>(ty, buf)),
        Type::INT4 => JsonValue::from(from_sql_or_none::<i32>(ty, buf)),
        Type::INT8 => JsonValue::from(from_sql_or_none::<i64>(ty, buf)),
        Type::FLOAT4 => JsonValue::from(from_sql_or_none::<f32>(ty, buf)),
        Type::FLOAT8 => JsonValue::from(from_sql_or_none::<f64>(ty, buf)),
        Type::NUMERIC => {
            JsonValue::from(from_sql_or_none::<Decimal>(ty, buf).map(|d| d.to_string()))
        }
        Type::OID => JsonValue::from(from_sql_or_none::<u32>(ty, buf)),

        // text
        Type::TEXT => JsonValue::from(from_sql_or_none::<String>(ty, buf)),
        Type::VARCHAR => JsonValue::from(from_sql_or_none::<String>(ty, buf)),
        Type::BPCHAR => JsonValue::from(from_sql_or_none::<String>(ty, buf)),
        Type::UNKNOWN => JsonValue::from(from_sql_or_none::<String>(ty, buf)),
        Type::NAME => JsonValue::from(from_sql_or_none::<String>(ty, buf)),
        ref ty if ["citext", "ltree", "lquery", "ltxtquery"].contains(&ty.name()) => {
            JsonValue::from(from_sql_or_none::<String>(ty, buf))
        }

        // uuid
        Type::UUID => JsonValue::from(from_sql_or_none::<Uuid>(ty, buf).map(|u| u.to_string())),

        // date/time
        Type::DATE => JsonValue::from(
            from_sql_or_none::<NaiveDate>(ty, buf).map(|d| d.format("%Y-%m-%d").to_string()),
        ),
        Type::TIME => JsonValue::from(
            from_sql_or_none::<NaiveTime>(ty, buf).map(|t| t.format("%H:%M:%S").to_string()),
        ),
        Type::TIMESTAMP => JsonValue::from(
            from_sql_or_none::<NaiveDateTime>(ty, buf)
                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string()),
        ),
        Type::TIMESTAMPTZ => JsonValue::from(
            from_sql_or_none::<DateTime<Utc>>(ty, buf)
                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string()),
        ),

        // json
        Type::JSON => JsonValue::from(from_sql_or_none::<JsonValue>(ty, buf)),
        Type::JSONB => JsonValue::from(from_sql_or_none::<JsonValue>(ty, buf)),

        // HashMap
        ref ty if ty.name() == "hstore" => {
            serde_json::to_value(from_sql_or_none::<HashMap<String, Option<String>>>(ty, buf))
                .unwrap_or_default()
        }

        // ip address
        Type::INET => JsonValue::from(from_sql_or_none::<IpAddr>(ty, buf).map(|ip| ip.to_string())),

        _ => JsonValue::Null,
    }
}

#[inline]
fn from_sql_or_none<'a, T>(ty: &Type, buf: &'a [u8]) -> Option<T>
where
    T: FromSql<'a>,
{
    match <Option<T> as FromSql>::from_sql(ty, buf) {
        Ok(value) => value,
        Err(e) => {
            log::error!("Failed to read value from sql: {:?}", e);
            None
        }
    }
}
