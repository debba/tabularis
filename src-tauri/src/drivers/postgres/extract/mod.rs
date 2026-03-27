mod array;
mod common;
mod composite;
mod simple;

use serde_json::Value as JsonValue;
use tokio_postgres::{
    types::{FromSql, Kind, Type},
    Row,
};

pub fn extract_value(row: &Row, index: usize) -> JsonValue {
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
            Kind::Domain(ty) => simple::extract_or_null(ty, raw),
            Kind::Array(ty) => {
                let mut buf = raw;
                array::extract_or_null(ty, &mut buf).unwrap_or_default()
            }
            Kind::Composite(fields) => {
                let mut buf = raw;
                composite::extract_or_null(fields, &mut buf).unwrap_or_default()
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

// #[inline]
// fn extract_array_into(of: &Type, buf: &mut &[u8], vec: &mut Vec<JsonValue>) {}

// TODO: support the following types

// Transaction Identifier: A 32-bit integer assigned to every transaction.
// Type::Xid Note:`tokio-postgres` does not accept mapping `Xid` to `i32`

// Command Identifier: A 32-bit integer that tracks the command sequence within a single transaction
// Type::Cid Note:`tokio-postgres` does not accept mapping `Cid` to `i32`

// (Tuple Identifier / ctid) A pair of (block number, tuple index within block)
// Type::Tid

// Type::Interval
// Type::Timetz
// Type::Jsonpath
// Type::Xml
// Type::Cidr
// Type::Regproc
// Type::PgNodeTree
// Type::Point
// Type::Lseg
// Type::Path
// Type::Box
// Type::Polygon
// Type::Line
// Type::Circle
// Type::Macaddr8
// Type::Money
// Type::Macaddr
// Type::Aclitem
// Type::Bit
// Type::Varbit
// Type::Refcursor
// Type::Regprocedure
// Type::Regoper
// Type::Regoperator
// Type::Regclass
// Type::Regtype
// Type::TxidSnapshot
// Type::PgLsn
// Type::PgNdistinct
// Type::PgDependencies
// Type::TsVector
// Type::Tsquery
// Type::GtsVector
// Type::Regconfig
// Type::Regdictionary
// Type::Regnamespace
// Type::Regrole
// Type::Regcollation
// Type::PgBrinBloomSummary
// Type::PgBrinMinmaxMultiSummary
// Type::PgMcvList
// Type::PgSnapshot
// Type::Xid8
