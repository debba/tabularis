mod advanced_types;
mod array;
mod common;
mod composite;
mod r#enum;
mod multi_range;
mod range;
mod simple;

use serde_json::Value as JsonValue;
use tokio_postgres::{
    types::{FromSql, Kind, Type},
    Row,
};

pub fn extract_value(row: &Row, index: usize, _known_type: Option<&str>) -> JsonValue {
    match row.try_get::<_, Extractor>(index) {
        Ok(extractor) => extractor.value,
        Err(_) => JsonValue::Null,
    }
}

/// used to get the raw value from postgres `Row`, before converting to `JsonValue`.
struct Extractor {
    value: JsonValue,
}

impl Extractor {
    #[inline(always)]
    const fn new() -> Self {
        Self {
            value: JsonValue::Null,
        }
    }
}

impl<'a> FromSql<'a> for Extractor {
    fn from_sql(
        ty: &Type,
        raw: &'a [u8],
    ) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> {
        let mut extractor = Extractor::new();
        extractor.value = match ty.kind() {
            Kind::Simple => simple::extract_or_null(ty, raw),
            Kind::Enum(_variants) => r#enum::extract_or_null(raw), // we don't need _variants
            Kind::Array(ty) => {
                let mut buf = raw;
                array::extract_or_null(ty, &mut buf)
            }
            Kind::Range(ty) => {
                let mut buf = raw;
                range::extract_or_null(ty, &mut buf)
            }
            Kind::Multirange(ty) => {
                let mut buf = raw;
                multi_range::extract_or_null(ty, &mut buf)
            }
            Kind::Domain(ty) => simple::extract_or_null(ty, raw),
            Kind::Composite(fields) => {
                let mut buf = raw;
                composite::extract_or_null(fields, &mut buf)
            }
            _ => JsonValue::Null, // unsupported
        };

        Ok(extractor)
    }

    #[inline(always)]
    fn accepts(_ty: &Type) -> bool {
        true
    }
}
