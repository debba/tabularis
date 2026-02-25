import type { Metadata } from "next";
import { Analytics } from "@/components/Analytics";
import { SearchModal } from "@/components/SearchModal";
import { getAllPosts } from "@/lib/posts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://tabularis.dev"),
  title: "Tabularis | Enjoy your queries again",
  description:
    "A lightweight, developer-focused database management tool, built with Tauri and React.",
  icons: { icon: "/img/logo.png" },
  openGraph: {
    type: "website",
    url: "https://tabularis.dev/",
    title: "Tabularis | Enjoy your queries again",
    description:
      "A lightweight, developer-focused database management tool, built with Tauri and React.",
    images: [
      "https://raw.githubusercontent.com/debba/tabularis/main/website/img/og.png",
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tabularis | Enjoy your queries again",
    description:
      "A lightweight, developer-focused database management tool, built with Tauri and React.",
    images: [
      "https://raw.githubusercontent.com/debba/tabularis/main/website/img/og.png",
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const posts = getAllPosts();
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        <SearchModal posts={posts} />
      </body>
    </html>
  );
}
