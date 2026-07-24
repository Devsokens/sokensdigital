import type { SocialPlatform } from "@/lib/api/types";

type IconProps = { className?: string };

function LinkedinGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.64h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.6c0-1.34-.02-3.06-1.87-3.06-1.87 0-2.16 1.46-2.16 2.96V21h-4V9Z" />
    </svg>
  );
}

function XGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.24 3h3.06l-6.69 7.64L22.5 21h-6.17l-4.83-6.32L5.96 21H2.9l7.16-8.18L1.75 3h6.33l4.37 5.78L18.24 3Zm-1.07 16.17h1.7L7.02 4.74H5.19l11.98 14.43Z" />
    </svg>
  );
}

function FacebookGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13.5 21v-7.6h2.55l.38-2.96h-2.93V8.55c0-.86.24-1.44 1.47-1.44h1.57V4.46c-.27-.04-1.2-.12-2.28-.12-2.26 0-3.8 1.38-3.8 3.9v2.18H8v2.96h2.46V21h3.04Z" />
    </svg>
  );
}

function InstagramGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function YoutubeGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M21.6 7.6a2.7 2.7 0 0 0-1.9-1.9C18 5.2 12 5.2 12 5.2s-6 0-7.7.5A2.7 2.7 0 0 0 2.4 7.6 28 28 0 0 0 2 12a28 28 0 0 0 .4 4.4 2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9A28 28 0 0 0 22 12a28 28 0 0 0-.4-4.4ZM10 15V9l5.2 3-5.2 3Z" />
    </svg>
  );
}

export const PLATFORM_META: Record<
  SocialPlatform,
  { label: string; Icon: (props: IconProps) => React.JSX.Element; color: string; bg: string; ring: string }
> = {
  LINKEDIN: { label: "LinkedIn", Icon: LinkedinGlyph, color: "#0a66c2", bg: "#0a66c2", ring: "#0a66c2" },
  TWITTER: { label: "X (Twitter)", Icon: XGlyph, color: "#0f1419", bg: "#000000", ring: "#0f1419" },
  FACEBOOK: { label: "Facebook", Icon: FacebookGlyph, color: "#1877f2", bg: "#1877f2", ring: "#1877f2" },
  INSTAGRAM: { label: "Instagram", Icon: InstagramGlyph, color: "#d6249f", bg: "#d6249f", ring: "#d6249f" },
  YOUTUBE: { label: "YouTube", Icon: YoutubeGlyph, color: "#ff0000", bg: "#ff0000", ring: "#ff0000" },
};

export function PlatformIcon({ platform, className }: { platform: SocialPlatform; className?: string }) {
  const { Icon } = PLATFORM_META[platform];
  return <Icon className={className} />;
}

export function PlatformBadge({ platform }: { platform: SocialPlatform }) {
  const meta = PLATFORM_META[platform];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ background: meta.bg }}
    >
      <PlatformIcon platform={platform} className="size-3" />
      {meta.label}
    </span>
  );
}
