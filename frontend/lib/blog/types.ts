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
  /** `icon` is a name (e.g. "shield-check"), resolved via
   * components/dynamic-icon's SectionIcon — not a component reference. */
  | { type: "callout"; icon: string; title: string; description: string };

export type BlogPost = {
  slug: string;
  title: string;
  author: string;
  date: string;
  excerpt: string;
  /** Icon name (e.g. "shield-check"), resolved via SectionIcon — not a component reference. */
  visualIcon: string;
  visualImage?: string;
  visualLabel: string;
  visualSublabel: string;
  tags: string[];
  content: Block[];
};
