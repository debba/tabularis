use serde_json::Value as JsonValue;
use tokio_postgres::types::{Kind, Type};

use super::common::split_at_value_len;

pub fn extract_or_null(ty: &Type, buf: &mut &[u8]) -> Result<JsonValue, ()> {
    // array must be at least 12 bytes (header) except if it is `NULL`
    if buf.len() == 0 {
        return Ok(JsonValue::Null);
    };

    if buf.len() < 12 {
        log::error!("array buffer too short: {}", buf.len());
        return Err(());
    };

    let dimentions = i32::from_be_bytes(buf[..4].try_into().unwrap());

    // i don't think this is possible but just in case
    if dimentions < 1 {
        log::error!("invalid number of dimensions: {}", dimentions);
        return Err(());
    };

    // max dimensions is 64 and just for safety
    if dimentions > 64 {
        log::error!("too many dimensions: {}", dimentions);
        return Err(());
    }

    let dimentions = dimentions as usize;

    // each dimension must have at least 8 bytes info
    if buf.len() * dimentions < 8 * dimentions {
        log::error!("array buffer too short: {}", buf.len());
        return Err(());
    };

    // ignore `has nulls` 4 bytes
    // ignore `element type` 4 bytes because we already have it
    *buf = &buf[12..];

    let mut total_vecs: usize = 1;
    let mut arr_lengths = Vec::with_capacity(dimentions);

    for i in 0..dimentions {
        let length = i32::from_be_bytes(buf[..4].try_into().unwrap());

        // i don't think this is possible but just in case
        if length < 0 {
            log::error!("invalid length: {}", length);
            return Err(());
        };

        let length = length as usize;

        arr_lengths.push(length);

        *buf = &buf[8..]; // skip `lower bound` 4 bytes

        if dimentions - i == 1 {
            continue;
        };

        let all_vecs_in_this_lvl = match total_vecs.checked_mul(length) {
            Some(v) => v,
            None => {
                log::error!("overflow: total_vecs={} length={}", total_vecs, length);
                return Err(());
            }
        };

        total_vecs = match total_vecs.checked_add(all_vecs_in_this_lvl) {
            Some(v) => v,
            None => {
                log::error!(
                    "overflow: total_vecs={} all_vecs_in_this_lvl={}",
                    total_vecs,
                    all_vecs_in_this_lvl
                );
                return Err(());
            }
        };
    }

    // SAFETY: i think this number should be discussed
    if total_vecs > 1024 {
        log::error!("too many vectors: total_vecs={}", total_vecs);
        return Err(());
    };

    let mut vec = Vec::with_capacity(arr_lengths[0]);

    extract_recursively_into(&mut vec, &arr_lengths, 1, &ty, buf)?;

    Ok(JsonValue::Array(vec))
}

fn extract_recursively_into(
    vec: &mut Vec<JsonValue>,
    arr_lengths: &[usize],
    depth: usize,
    ty: &Type,
    buf: &mut &[u8],
) -> Result<(), ()> {
    match depth == arr_lengths.len() {
        true => {
            for _ in 0..arr_lengths[depth - 1] {
                vec.push(extract_elem(ty, buf)?);
            }
        }

        false => {
            for _ in 0..arr_lengths[depth - 1] {
                let mut sub_vec = Vec::with_capacity(arr_lengths[depth - 1]);
                extract_recursively_into(&mut sub_vec, arr_lengths, depth + 1, ty, buf)?;
                vec.push(JsonValue::Array(sub_vec));
            }
        }
    };

    Ok(())
}

#[inline]
fn extract_elem(ty: &Type, buf: &mut &[u8]) -> Result<JsonValue, ()> {
    let mut value_buf = split_at_value_len(buf)?;

    match ty.kind() {
        Kind::Simple => Ok(super::simple::extract_or_null(ty, value_buf)),
        Kind::Domain(inner) => Ok(super::simple::extract_or_null(inner, value_buf)),
        Kind::Array(_) => Ok(JsonValue::Null), // impossible case
        Kind::Composite(fields) => super::composite::extract_or_null(fields, &mut value_buf),
        _ => Ok(JsonValue::Null),
    }
}

mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn test_simple_1d_pg_array_extraction() {
        let arr = [
            0, 0, 0, 1, // dimenstions 1
            0, 0, 0, 0, // has nulls 0: false, 1: true
            0, 0, 0, 17, // oid 17 = INT4
            0, 0, 0, 3, // array length
            0, 0, 0, 1, // lower bound
            // the following is a sequance of element length and element bytes
            0, 0, 0, 4, // length 4 bytes
            0, 0, 0, 1, // element
            0, 0, 0, 4, // length
            0, 0, 0, 2, // element
            0, 0, 0, 4, // length
            0, 0, 0, 3, // element
        ];
        let mut buf = &arr[..];
        let json = extract_or_null(&Type::INT4, &mut buf);
        assert_eq!(
            json,
            Ok(JsonValue::Array(vec![
                JsonValue::Number(1.into()),
                JsonValue::Number(2.into()),
                JsonValue::Number(3.into())
            ]))
        );
    }

    #[test]
    fn test_simple_2dim_pg_array_extraction() {
        let arr = [
            0, 0, 0, 2, // dimensions 2
            0, 0, 0, 0, // has nulls 0: false, 1: true
            0, 0, 0, 17, // oid 17 = INT4
            0, 0, 0, 2, // outer array length: we have 2 sub arrays
            0, 0, 0, 1, // lower bound
            0, 0, 0, 2, // inner array lengths: each sub array has 2 elements
            0, 0, 0, 1, // lower bound
            // the following is a sequance of element length and element bytes for each array
            // beginning of first array
            0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 4, 0, 0, 0, 2,
            // end of first array
            // beginning of second array
            0, 0, 0, 4, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0, 4,
        ];
        let mut buf = &arr[..];
        let json = extract_or_null(&Type::INT4, &mut buf);
        assert_eq!(
            json,
            Ok(JsonValue::Array(vec![
                JsonValue::Array(vec![
                    JsonValue::Number(1.into()),
                    JsonValue::Number(2.into()),
                ]),
                JsonValue::Array(vec![
                    JsonValue::Number(3.into()),
                    JsonValue::Number(4.into()),
                ]),
            ]))
        );
    }

    #[test]
    fn test_simple_3dim_pg_array_extraction() {
        let arr = [
            0, 0, 0, 3, // dimensions: 3 dimensions
            0, 0, 0, 0, // has nulls 0: false, 1: true
            0, 0, 0, 17, // oid 17 = INT4
            0, 0, 0, 2, // main array length: we have 2 sub arrays
            0, 0, 0, 1, // lower bound
            0, 0, 0, 2, // level 1 array lengths: each level 1 array has 2 elements
            0, 0, 0, 1, // lower bound
            0, 0, 0, 2, // level 2 array lengths: each level 2 array has 2 elements
            0, 0, 0, 1, // lower bound
            // beginning of (level 1 first array -> level 2 first array)
            0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 4, 0, 0, 0, 2,
            // end
            // beginning of (level 1 first array -> level 2 second array)
            0, 0, 0, 4, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0, 4,
            // beginning of (level 1 second array -> level 2 first array)
            0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 4, 0, 0, 0, 2,
            // end
            // beginning of (level 1 second array -> level 2 second array)
            0, 0, 0, 4, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0, 4,
        ];
        let mut buf = &arr[..];
        let json = extract_or_null(&Type::INT4, &mut buf);
        assert_eq!(
            json,
            Ok(JsonValue::Array(vec![
                JsonValue::Array(vec![
                    JsonValue::Array(vec![
                        JsonValue::Number(1.into()),
                        JsonValue::Number(2.into()),
                    ]),
                    JsonValue::Array(vec![
                        JsonValue::Number(3.into()),
                        JsonValue::Number(4.into()),
                    ]),
                ]),
                JsonValue::Array(vec![
                    JsonValue::Array(vec![
                        JsonValue::Number(1.into()),
                        JsonValue::Number(2.into()),
                    ]),
                    JsonValue::Array(vec![
                        JsonValue::Number(3.into()),
                        JsonValue::Number(4.into()),
                    ]),
                ])
            ]))
        );
    }
}
