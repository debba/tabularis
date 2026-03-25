use std::sync::Arc;

use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use rust_decimal::Decimal;
use serde_json::Value as JsonValue;
use sqlx::{
    error::BoxDynError,
    postgres::{types::PgRecordDecoder, PgTypeInfo, PgTypeKind, PgValueRef},
    Postgres, Row, ValueRef,
};
use uuid::Uuid;

use crate::drivers::common::encode_blob;

/// Extract value from PostgreSQL row
pub fn extract_value(row: &sqlx::postgres::PgRow, index: usize) -> JsonValue {
    let val_ref = match row.try_get_raw(index) {
        Ok(val_ref) => val_ref,
        Err(e) => {
            log::error!("Failed to get raw value: {}", e);
            return JsonValue::Null;
        }
    };

    get_or_null(val_ref.type_info().kind().clone(), val_ref)
}

fn get_or_null(kind: PgTypeKind, val_ref: PgValueRef<'_>) -> JsonValue {
    if val_ref.is_null() {
        return JsonValue::Null;
    };

    match kind {
        PgTypeKind::Simple => get_simple_or_null(val_ref),
        PgTypeKind::Domain(inner_ty) => get_or_null(inner_ty.kind().clone(), val_ref),
        PgTypeKind::Array(sub_ty) => get_array_or_null(sub_ty, val_ref),
        PgTypeKind::Composite(fields_info) => get_composite_or_null(fields_info, val_ref),
        _ => JsonValue::Null,
    }
}

#[inline]
/// Extract a simple value from a PostgreSQL row, returning `JsonValue::Null` if the type is not compatible
fn get_simple_or_null(val_ref: PgValueRef<'_>) -> JsonValue {
    let ty = val_ref.type_info();

    macro_rules! decode_if_compatible {
        ($ty:ty, $(. $method: ident ($($arg: expr),*))*) => {
            if is_compatible::<$ty>(&ty) {
                return match decode::<$ty>(val_ref) {
                    Ok(v) => JsonValue::from(v$(.$method($($arg),*))*),
                    Err(e) => {
                        log::error!("Failed to decode to {}: {}", stringify!($ty), e);
                        JsonValue::Null
                    }
                };
            }
        };
    }

    decode_if_compatible!(i8,); // corresponds to `"CHAR"` postgres type not `CHAR(N)`
    decode_if_compatible!(i16,);
    decode_if_compatible!(i32,);
    decode_if_compatible!(i64,);
    decode_if_compatible!(f32,);
    decode_if_compatible!(f64,);
    decode_if_compatible!(bool,);
    decode_if_compatible!(String,);
    decode_if_compatible!(JsonValue,);
    decode_if_compatible!(DateTime<Utc>, .format("%Y-%m-%d %H:%M:%S").to_string());
    decode_if_compatible!(DateTime<Local>, .format("%Y-%m-%d %H:%M:%S").to_string());
    decode_if_compatible!(NaiveDateTime, .format("%Y-%m-%d %H:%M:%S").to_string());
    decode_if_compatible!(NaiveDate, .to_string());
    decode_if_compatible!(NaiveTime, .to_string());
    decode_if_compatible!(Decimal, .to_string());
    decode_if_compatible!(Uuid, .to_string());

    // corresponds to `BYTEA` postgres type
    if is_compatible::<Vec<u8>>(&ty) {
        return match decode::<Vec<u8>>(val_ref) {
            Ok(v) => JsonValue::from(encode_blob(&v)),
            Err(e) => {
                log::error!("Failed to decode to Vec<u8>: {}", e);
                JsonValue::Null
            }
        };
    }

    JsonValue::Null
}

#[inline]
/// Extract a composite value from a PostgreSQL row, returning `JsonValue::Null` if the type is not compatible or the decoding fails
fn get_composite_or_null(
    fields_info: Arc<[(String, PgTypeInfo)]>,
    val_ref: PgValueRef<'_>,
) -> JsonValue {
    let mut record_decoder = match PgRecordDecoder::new(val_ref) {
        Ok(decoder) => decoder,
        Err(e) => {
            log::error!("Failed to decode to record: {}", e);
            return JsonValue::Null;
        }
    };

    let mut obj = serde_json::Map::new();

    for (name, ty) in fields_info.iter() {
        obj.insert(name.clone(), get_field_or_null(ty, &mut record_decoder));
    }

    JsonValue::from(obj)
}

#[inline]
/// Extract a field value from a PostgreSQL composite type (record), returning `JsonValue::Null` if the type is not compatible or the decoding fails
fn get_field_or_null(ty: &PgTypeInfo, record_decoder: &mut PgRecordDecoder<'_>) -> JsonValue {
    match ty.kind().clone() {
        PgTypeKind::Simple => get_simple_field_or_null(ty, record_decoder),
        PgTypeKind::Domain(inner_ty) => get_field_or_null(&inner_ty, record_decoder),
        PgTypeKind::Composite(_) => {
            log::error!("nested composite types are not supported");
            JsonValue::Null
        }
        PgTypeKind::Array(sub_ty) => get_array_field_or_null(sub_ty, record_decoder),
        _ => JsonValue::Null,
    }
}

#[inline]
/// Extract a simple field value from a PostgreSQL composite type (record), returning `JsonValue::Null` if the type is not compatible or the decoding fails
fn get_simple_field_or_null(
    ty: &PgTypeInfo,
    record_decoder: &mut PgRecordDecoder<'_>,
) -> JsonValue {
    macro_rules! decode_if_compatible {
        ($ty:ty, $(. $method: ident ($($arg: expr),*))*) => {
            if is_compatible::<$ty>(&ty) {
                return match record_decoder.try_decode::<$ty>() {
                    Ok(v) => JsonValue::from(v$(.$method($($arg),*))*),
                    Err(e) => {
                        log::error!("Failed to decode to {}: {}", stringify!($ty), e);
                        JsonValue::Null
                    }
                };
            }
        };
    }

    decode_if_compatible!(i8,); // corresponds to `"CHAR"` postgres type not `CHAR(N)`
    decode_if_compatible!(i16,);
    decode_if_compatible!(i32,);
    decode_if_compatible!(i64,);
    decode_if_compatible!(f32,);
    decode_if_compatible!(f64,);
    decode_if_compatible!(bool,);
    decode_if_compatible!(String,);
    decode_if_compatible!(JsonValue,);
    decode_if_compatible!(DateTime<Utc>, .format("%Y-%m-%d %H:%M:%S").to_string());
    decode_if_compatible!(DateTime<Local>, .format("%Y-%m-%d %H:%M:%S").to_string());
    decode_if_compatible!(NaiveDateTime, .format("%Y-%m-%d %H:%M:%S").to_string());
    decode_if_compatible!(NaiveDate, .to_string());
    decode_if_compatible!(NaiveTime, .to_string());
    decode_if_compatible!(Decimal, .to_string());
    decode_if_compatible!(Uuid, .to_string());

    // corresponds to `BYTEA` postgres type
    if is_compatible::<Vec<u8>>(&ty) {
        return match record_decoder.try_decode::<Vec<u8>>() {
            Ok(v) => JsonValue::from(encode_blob(&v)),
            Err(e) => {
                log::error!("Failed to decode to Vec<u8>: {}", e);
                JsonValue::Null
            }
        };
    }

    JsonValue::Null
}

#[inline]
/// Extract an array value from a field of a PostgreSQL composite type (record), returning `JsonValue::Null` if the type is not compatible or the decoding fails
fn get_array_field_or_null(
    sub_ty: PgTypeInfo,
    record_decoder: &mut PgRecordDecoder<'_>,
) -> JsonValue {
    match sub_ty.kind() {
        PgTypeKind::Simple => get_simple_array_field_or_null(sub_ty, record_decoder),
        PgTypeKind::Array(_) => {
            log::error!("nested arrays are not supported");
            JsonValue::Null
        }
        _ => JsonValue::Null,
    }
}

#[inline]
/// Extract a simple array value from a field of a PostgreSQL composite type (record), returning `JsonValue::Null` if the type is not compatible or the decoding fails
fn get_simple_array_field_or_null(
    sub_ty: PgTypeInfo,
    record_decoder: &mut PgRecordDecoder<'_>,
) -> JsonValue {
    macro_rules! decode_if_compatible {
        ($ty:ty, $(. $method: ident ($($arg: expr),*))*) => {
            if is_compatible::<$ty>(&sub_ty) {
                return match record_decoder.try_decode::<Vec<$ty>>() {
                    Ok(v) => JsonValue::Array(
                        v.into_iter().map(|d| JsonValue::from(d$(.$method($($arg),*))*)).collect(),
                    ),
                    Err(e) => {
                        log::error!("Failed to decode to {}: {}", stringify!($ty), e);
                        JsonValue::Null
                    }
                };
            }
        };
    }

    decode_if_compatible!(i16,);
    decode_if_compatible!(i32,);
    decode_if_compatible!(i64,);
    decode_if_compatible!(f32,);
    decode_if_compatible!(f64,);
    decode_if_compatible!(bool,);
    decode_if_compatible!(String,);
    decode_if_compatible!(JsonValue,);
    decode_if_compatible!(DateTime<Utc>, .format("%Y-%m-%d %H:%M:%S").to_string());
    decode_if_compatible!(DateTime<Local>, .format("%Y-%m-%d %H:%M:%S").to_string());
    decode_if_compatible!(NaiveDateTime, .format("%Y-%m-%d %H:%M:%S").to_string());
    decode_if_compatible!(NaiveDate, .to_string());
    decode_if_compatible!(NaiveTime, .to_string());
    decode_if_compatible!(Decimal, .to_string());
    decode_if_compatible!(Uuid, .to_string());

    JsonValue::Null
}

#[inline]
/// Extract an array value from a PostgreSQL row, returning `JsonValue::Null` if the type is not compatible or the decoding fails
fn get_array_or_null(sub_ty: PgTypeInfo, val_ref: PgValueRef<'_>) -> JsonValue {
    match sub_ty.kind() {
        PgTypeKind::Simple => get_simple_array_or_null(sub_ty, val_ref),
        PgTypeKind::Array(_) => {
            log::error!("nested arrays are not supported");
            JsonValue::Null
        }
        _ => JsonValue::Null,
    }
}

#[inline]
/// Extract a simple array value from a PostgreSQL row, returning `JsonValue::Null` if the type is not compatible or the decoding fails
fn get_simple_array_or_null(sub_ty: PgTypeInfo, val_ref: PgValueRef<'_>) -> JsonValue {
    macro_rules! decode_if_compatible {
        ($ty:ty, $(. $method: ident ($($arg: expr),*))*) => {
            if is_compatible::<$ty>(&sub_ty) {
                return match decode::<Vec<$ty>>(val_ref) {
                    Ok(v) => JsonValue::Array(
                        v.into_iter().map(|d| JsonValue::from(d$(.$method($($arg),*))*)).collect(),
                    ),
                    Err(e) => {
                        log::error!("Failed to decode to {}: {}", stringify!($ty), e);
                        JsonValue::Null
                    }
                };
            }
        };
    }

    decode_if_compatible!(i16,);
    decode_if_compatible!(i32,);
    decode_if_compatible!(i64,);
    decode_if_compatible!(f32,);
    decode_if_compatible!(f64,);
    decode_if_compatible!(bool,);
    decode_if_compatible!(String,);
    decode_if_compatible!(JsonValue,);
    decode_if_compatible!(DateTime<Utc>, .format("%Y-%m-%d %H:%M:%S").to_string());
    decode_if_compatible!(DateTime<Local>, .format("%Y-%m-%d %H:%M:%S").to_string());
    decode_if_compatible!(NaiveDateTime, .format("%Y-%m-%d %H:%M:%S").to_string());
    decode_if_compatible!(NaiveDate, .to_string());
    decode_if_compatible!(NaiveTime, .to_string());
    decode_if_compatible!(Decimal, .to_string());
    decode_if_compatible!(Uuid, .to_string());

    JsonValue::Null
}

#[inline(always)]
fn is_compatible<T>(ty: &PgTypeInfo) -> bool
where
    T: sqlx::Type<Postgres>,
{
    T::compatible(ty)
}

#[inline(always)]
fn decode<'a, T>(val_ref: PgValueRef<'a>) -> Result<T, BoxDynError>
where
    T: sqlx::Decode<'a, Postgres>,
{
    T::decode(val_ref)
}
