export type BlogPost = {
  slug: string;
  title: string;
  author: string;
  date: string;
  coverImage?: string;
  /** Plain-text snippet derived from `content`, for card previews. */
  excerpt: string;
  /** Rich text HTML from the admin's editor. */
  content: string;
};
