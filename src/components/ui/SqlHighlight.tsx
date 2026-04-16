import { useColorizedSql, formatSqlPreview } from "../../utils/sqlHighlight";

interface SqlHighlightProps {
  sql: string;
  maxLines?: number;
}

export function SqlHighlight({ sql, maxLines = 3 }: SqlHighlightProps) {
  const preview = formatSqlPreview(sql, maxLines);
  const html = useColorizedSql(preview);

  if (html) {
    return (
      <div
        className="text-[11px] leading-[1.4] font-mono [&_br]:hidden [&>span]:!bg-transparent"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // Fallback: plain text while Monaco loads
  return (
    <pre className="text-[11px] leading-[1.4] font-mono whitespace-pre-wrap break-all text-secondary">
      {preview}
    </pre>
  );
}
