import type { SceneVariant } from "@/components/projects/mockup-scenes";

export type ProjectStat = { value: string; label: string };

export type Project = {
  slug: string;
  category: string;
  sector: string;
  type: string;
  featured?: boolean;
  statusTag: string;
  tag: string;
  title: string;
  description: string;
  /** Icon name (e.g. "shield-check"), resolved via components/dynamic-icon's SectionIcon — not a component reference. */
  visualIcon: string;
  /** The live/deployed product itself — not this site's own detail page. */
  projectUrl?: string;
  /** Real demo video, set once the back office provides one. Takes priority over `images`. */
  videoSrc?: string;
  /** Real screenshots, set once the back office provides them. Auto-cycled with a crossfade. */
  images?: string[];
  /** Placeholder animated scenes cycled while no real video/images exist yet. */
  sceneVariants?: SceneVariant[];
  client: string;
  technologies: string[];
  timeline: string;
  leadName: string;
  leadRole: string;
  challenge: string;
  stats: ProjectStat[];
  solution: string;
  solutionPoints: string[];
};
