//! SQL identifier quoting.

/// Quote an identifier using the given quote character, doubling any
/// occurrences of that character inside the identifier to escape them.
///
/// ```
/// assert_eq!(quote_identifier("users", '"'), "\"users\"");
/// assert_eq!(quote_identifier("weird\"name", '"'), "\"weird\"\"name\"");
/// assert_eq!(quote_identifier("items", '`'),  "`items`");
/// ```
pub fn quote_identifier(name: &str, quote: char) -> String {
    let mut out = String::with_capacity(name.len() + 2);
    out.push(quote);
    for c in name.chars() {
        if c == quote {
            out.push(quote);
        }
        out.push(c);
    }
    out.push(quote);
    out
}

#[cfg(test)]
mod tests {
    use super::quote_identifier;

    #[test]
    fn quotes_plain_names() {
        assert_eq!(quote_identifier("users", '"'), "\"users\"");
        assert_eq!(quote_identifier("users", '`'), "`users`");
    }

    #[test]
    fn escapes_embedded_quotes() {
        assert_eq!(quote_identifier("a\"b", '"'), "\"a\"\"b\"");
        assert_eq!(quote_identifier("a`b", '`'), "`a``b`");
    }

    #[test]
    fn handles_empty() {
        assert_eq!(quote_identifier("", '"'), "\"\"");
    }
}
