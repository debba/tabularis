import { formatDate } from "@/lib/posts";
import { PostTagBadge } from "./PostTagBadge";

interface PostMetaBarProps {
  date: string;
  release?: string;
  tags?: string[];
}

export function PostMetaBar({ date, release, tags = [] }: PostMetaBarProps) {
  return (
    <div className="post-meta">
      <span>{formatDate(date)}</span>
      <span>&middot;</span>
      <span>2 min read</span>
      {release && (
        <>
          <span>&middot;</span>
          <span className="post-release">{release}</span>
        </>
      )}
      {tags.length > 0 && (
        <>
          <span>&middot;</span>
          {tags.map((t) => (
            <PostTagBadge key={t} tag={t} />
          ))}
        </>
      )}
    </div>
  );
}
