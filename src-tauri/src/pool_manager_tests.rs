#[cfg(test)]
mod tests {
    use crate::pool_manager::format_error_chain;

    #[test]
    fn format_error_chain_walks_sources() {
        use std::error::Error as StdError;
        use std::fmt;

        #[derive(Debug)]
        struct Inner;
        impl fmt::Display for Inner {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str("inner cause")
            }
        }
        impl StdError for Inner {}

        #[derive(Debug)]
        struct Outer(Inner);
        impl fmt::Display for Outer {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str("outer message")
            }
        }
        impl StdError for Outer {
            fn source(&self) -> Option<&(dyn StdError + 'static)> {
                Some(&self.0)
            }
        }

        assert_eq!(
            format_error_chain(&Outer(Inner)),
            "outer message -> inner cause"
        );
    }
}
