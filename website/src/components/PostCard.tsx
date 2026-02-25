import Link from "next/link";
import { type PostMeta, formatDate } from "@/lib/posts";

interface PostCardProps {
  post: PostMeta;
}

export function PostCard({ post }: PostCardProps) {
  const tags = post.tags ?? [];
  return (
    <div className="post-card">
      <div className="post-meta">
        <span>{formatDate(post.date)}</span>
        <span>&middot;</span>
        <span>2 min read</span>
        {post.release && (
          <>
            <span>&middot;</span>
            <span className="post-release">{post.release}</span>
          </>
        )}
        {tags.length > 0 && (
          <>
            <span>&middot;</span>
            {tags.map((t) => (
              <Link key={t} href={`/blog/tag/${t}`} className="post-tag">
                {t}
              </Link>
            ))}
          </>
        )}
      </div>
      <Link href={`/blog/${post.slug}`} className="post-card-body">
        <div className="post-title">{post.title}</div>
        <div className="post-excerpt">{post.excerpt}</div>
      </Link>
    </div>
  );
}
