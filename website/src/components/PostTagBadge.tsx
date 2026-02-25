import Link from "next/link";

interface PostTagBadgeProps {
  tag: string;
}

export function PostTagBadge({ tag }: PostTagBadgeProps) {
  return (
    <Link href={`/blog/tag/${encodeURIComponent(tag)}`} className="post-tag">
      {tag}
    </Link>
  );
}
