import Link from "next/link";

interface BlogHeaderProps {
  crumbs?: Array<{ label: string; href?: string }>;
}

export function BlogHeader({ crumbs = [] }: BlogHeaderProps) {
  return (
    <header className="site-header">
      <Link href="/" className="back-link">
        &larr; tabularis
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={i}>
          <span className="sep">/</span>{" "}
          {crumb.href ? (
            <Link href={crumb.href} className="crumb">
              {crumb.label}
            </Link>
          ) : (
            <span className="crumb">{crumb.label}</span>
          )}
        </span>
      ))}
      <div className="header-links">
        <a href="https://github.com/debba/tabularis">GitHub</a>
        <a href="https://discord.gg/YrZPHAwMSG">Discord</a>
      </div>
    </header>
  );
}
