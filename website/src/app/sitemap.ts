export const dynamic = "force-static";

import type { MetadataRoute } from "next";
import { getAllWikiPages } from "@/lib/wiki";
import { getAllPosts } from "@/lib/posts";

const BASE_URL = "https://tabularis.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const wikiPages = getAllWikiPages();
  const posts = getAllPosts();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/wiki`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/plugins`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  const wikiRoutes: MetadataRoute.Sitemap = wikiPages.map((page) => ({
    url: `${BASE_URL}/wiki/${page.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const blogRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...wikiRoutes, ...blogRoutes];
}
