import Link from "next/link";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

function pageHref(page: number): string {
  return page === 1 ? "/blog" : `/blog/page/${page}`;
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination">
      {currentPage > 1 ? (
        <Link href={pageHref(currentPage - 1)} className="pagination-btn">
          ← Prev
        </Link>
      ) : (
        <span className="pagination-btn disabled">← Prev</span>
      )}

      <span className="pagination-pages">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <Link
            key={page}
            href={pageHref(page)}
            className={`pagination-page${page === currentPage ? " active" : ""}`}
          >
            {page}
          </Link>
        ))}
      </span>

      {currentPage < totalPages ? (
        <Link href={pageHref(currentPage + 1)} className="pagination-btn">
          Next →
        </Link>
      ) : (
        <span className="pagination-btn disabled">Next →</span>
      )}
    </nav>
  );
}
