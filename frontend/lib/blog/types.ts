import type { LucideIcon } from "lucide-react";

export type Tone = "medium" | "high" | "critical";

export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string; center?: boolean }
  | { type: "code"; filename: string; code: string }
  | {
      type: "table";
      headers: string[];
      rows: { cells: string[]; tone?: Tone }[];
    }
  | {
      type: "compare";
      left: { title: string; description: string; accent: "cyan" | "amber" };
      right: { title: string; description: string; accent: "cyan" | "amber" };
    }
  | { type: "callout"; icon: LucideIcon; title: string; description: string };

export type BlogPost = {
  slug: string;
  title: string;
  author: string;
  date: string;
  excerpt: string;
  visualIcon: LucideIcon;
  visualLabel: string;
  visualSublabel: string;
  tags: string[];
  content: Block[];
};
