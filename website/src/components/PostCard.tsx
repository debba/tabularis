import Link from "next/link";
import { type PostMeta } from "@/lib/posts";
import { PostMetaBar } from "./PostMetaBar";

interface PostCardProps {
  post: PostMeta;
}

export function PostCard({ post }: PostCardProps) {
  return (
    <div className="post-card">
      <PostMetaBar date={post.date} release={post.release} tags={post.tags} />
      <Link href={`/blog/${post.slug}`} className="post-card-body">
        <div className="post-title">{post.title}</div>
        <div className="post-excerpt">{post.excerpt}</div>
      </Link>
    </div>
  );
}
