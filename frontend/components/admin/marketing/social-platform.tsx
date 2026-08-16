import type { SocialPlatform } from "@/lib/api/types";

type IconProps = { className?: string };

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

export const PLATFORM_META: Record<
  SocialPlatform,
  { label: string; Icon: (props: IconProps) => React.JSX.Element; color: string; bg: string; ring: string }
> = {
  FACEBOOK: { label: "Facebook", Icon: FacebookGlyph, color: "#1877f2", bg: "#1877f2", ring: "#1877f2" },
  INSTAGRAM: { label: "Instagram", Icon: InstagramGlyph, color: "#d6249f", bg: "#d6249f", ring: "#d6249f" },
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
