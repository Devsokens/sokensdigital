export type BlogPost = {
  slug: string;
  title: string;
  author: string;
  date: string;
  /** Date ISO brute (SEO : sitemap, datePublished JSON-LD). */
  publishedAt?: string | null;
  coverImage?: string;
  /** Plain-text snippet derived from `content`, for card previews. */
  excerpt: string;
  /** Rich text HTML from the admin's editor. */
  content: string;
};
