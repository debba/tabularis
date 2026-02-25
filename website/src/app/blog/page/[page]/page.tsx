import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogHeader } from "@/components/BlogHeader";
import { Footer } from "@/components/Footer";
import { GitHubIcon, DiscordIcon } from "@/components/Icons";
import { PostCard } from "@/components/PostCard";
import { Pagination } from "@/components/Pagination";
import { getPaginatedPosts, getAllPosts, POSTS_PER_PAGE } from "@/lib/posts";

export function generateStaticParams() {
  const total = getAllPosts().length;
  const totalPages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));
  // With output: export, returning [] is treated as missing generateStaticParams.
  // Always generate at least page "2"; the component calls notFound() when out of range.
  const count = Math.max(1, totalPages - 1);
  return Array.from({ length: count }, (_, i) => ({
    page: String(i + 2),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const { page } = await params;
  return {
    title: `Blog – Page ${page} | Tabularis`,
    description:
      "Release notes and updates from the Tabularis project — one post per release.",
  };
}

export default async function BlogPageN({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page: pageStr } = await params;
  const page = Number(pageStr);
  const { posts, totalPages, currentPage } = getPaginatedPosts(page);

  if (!posts.length || currentPage !== page) {
    notFound();
  }

  return (
    <div className="container">
      <BlogHeader
        crumbs={[
          { label: "blog", href: "/blog" },
          { label: `page ${page}` },
        ]}
      />

      <section>
        <h2>_blog</h2>

        <div className="post-list">
          {posts.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>

        <Pagination currentPage={currentPage} totalPages={totalPages} />

        <div className="cta-strip">
          <a className="btn-cta" href="https://github.com/debba/tabularis">
            <GitHubIcon size={16} />
            Star on GitHub
          </a>
          <a
            className="btn-cta discord"
            href="https://discord.gg/YrZPHAwMSG"
          >
            <DiscordIcon size={16} />
            Join Discord
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
