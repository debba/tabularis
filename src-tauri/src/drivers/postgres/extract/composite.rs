use serde_json::{Map, Value as JsonValue};
use tokio_postgres::types::{self as pg_types, Field, Kind};

use super::common::split_at_value_len;

#[inline]
pub fn extract_or_null(fields: &Vec<Field>, buf: &mut &[u8]) -> Result<JsonValue, ()> {
    if buf.len() == 0 {
        log::error!("recieved empty buffer");
        return Err(());
    };

    let mut map = serde_json::Map::with_capacity(fields.len());
    extract_into(fields, buf, &mut map)?;
    Ok(JsonValue::Object(map))
}

fn extract_into(
    fields: &Vec<Field>,
    buf: &mut &[u8],
    map: &mut Map<String, JsonValue>,
) -> Result<(), ()> {
    // this step is important because `read_be_i32` moves 4 bytes forward
    // also, i think we can ignore the composite length and just read the fields
    if let Err(e) = pg_types::private::read_be_i32(buf) {
        log::error!("Failed to read composite length: {:?}", e);
        // if reading the composite length fails (which happens only if the buffer is less than 4 bytes),
        // we can't proceed with extracting the composite fields, so we return early
        return Err(());
    };

    for field in fields {
        map.insert(
            field.name().to_string(),
            extract_field_or_null_into(field, buf)?,
        );
    }

    Ok(())
}

#[inline]
fn extract_field_or_null_into(field: &Field, buf: &mut &[u8]) -> Result<JsonValue, ()> {
    let mut value_buf = split_at_value_len(buf)?;

    let ty = field.type_();

    Ok(match ty.kind() {
        Kind::Simple => super::simple::extract_or_null(ty, value_buf),
        Kind::Domain(ty) => super::simple::extract_or_null(ty, value_buf),
        Kind::Composite(fields) => {
            let mut map = Map::with_capacity(fields.len());
            extract_into(fields, &mut value_buf, &mut map)?;
            JsonValue::from(map)
        }
        Kind::Array(of) => super::array::extract_or_null(of, &mut value_buf)?,
        _ => JsonValue::Null,
    })
}
