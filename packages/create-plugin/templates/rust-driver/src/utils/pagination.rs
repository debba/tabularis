//! Pagination helpers.

/// Wrap a SELECT with LIMIT/OFFSET. Page numbers are 1-indexed.
///
/// ```
/// assert_eq!(
///   paginate("SELECT * FROM users", 2, 50),
///   "SELECT * FROM users LIMIT 50 OFFSET 50"
/// );
/// ```
pub fn paginate(query: &str, page: u64, page_size: u64) -> String {
    let safe_page = page.max(1);
    let offset = (safe_page - 1).saturating_mul(page_size);
    format!("{} LIMIT {} OFFSET {}", query.trim(), page_size, offset)
}

#[cfg(test)]
mod tests {
    use super::paginate;

    #[test]
    fn first_page() {
        assert_eq!(paginate("SELECT 1", 1, 100), "SELECT 1 LIMIT 100 OFFSET 0");
    }

    #[test]
    fn later_page() {
        assert_eq!(paginate("SELECT 1", 3, 25), "SELECT 1 LIMIT 25 OFFSET 50");
    }

    #[test]
    fn page_zero_treated_as_one() {
        assert_eq!(paginate("SELECT 1", 0, 10), "SELECT 1 LIMIT 10 OFFSET 0");
    }
}
