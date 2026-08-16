import { Heart, MessageCircle, Send, Share2, ThumbsUp } from "lucide-react";
import { PlatformIcon } from "@/components/admin/marketing/social-platform";
import type { SocialPlatform } from "@/lib/api/types";

const AVATAR_LETTERS = "SD";

function Avatar({ className }: { className?: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary ${className}`}>
      {AVATAR_LETTERS}
    </div>
  );
}

function CarouselBadge({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
      1/{count}
    </span>
  );
}

type Props = {
  platform: SocialPlatform;
  title: string;
  content: string;
  /** Cover image first, any additional carousel images after — see
   * SocialPost.additional_images. */
  images: string[];
};

/** A best-effort visual approximation of how the post will actually look on
 * its target platform — not a pixel-exact clone of each app's UI, just
 * enough real layout/branding to review before publishing. */
export function SocialPostPreview({ platform, title, content, images }: Props) {
  const [imagePath] = images;

  if (platform === "INSTAGRAM") {
    return (
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Avatar className="size-8 text-xs" />
          <p className="text-sm font-semibold text-neutral-900">sokensdigital</p>
        </div>
        <div className="relative flex aspect-square items-center justify-center bg-neutral-100">
          {imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePath} alt="" className="size-full object-cover" />
          ) : (
            <PlatformIcon platform={platform} className="size-10 text-neutral-300" />
          )}
          <CarouselBadge count={images.length} />
        </div>
        <div className="flex items-center gap-3 px-3 pt-2.5 text-neutral-700">
          <Heart className="size-5" />
          <MessageCircle className="size-5" />
          <Send className="size-5" />
        </div>
        <p className="px-3 py-2 text-sm text-neutral-800">
          <span className="font-semibold">sokensdigital</span> {content || <span className="text-neutral-400">{title || "Contenu du post…"}</span>}
        </p>
      </div>
    );
  }

  // Facebook — "feed card" shape.
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-center gap-2.5 p-3.5">
        <Avatar className="size-10 text-sm" />
        <div>
          <p className="text-sm font-semibold text-neutral-900">Soken&apos;s Digital</p>
          <p className="text-xs text-neutral-500">Maintenant · <PlatformIcon platform={platform} className="inline size-3" /></p>
        </div>
      </div>
      <p className="px-3.5 pb-3 text-sm whitespace-pre-wrap text-neutral-800">
        {content || <span className="text-neutral-400">{title || "Contenu du post…"}</span>}
      </p>
      {imagePath && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePath} alt="" className="max-h-64 w-full object-cover" />
          <CarouselBadge count={images.length} />
        </div>
      )}
      <div className="flex items-center gap-4 border-t border-neutral-100 px-3.5 py-2 text-neutral-400">
        <ThumbsUp className="size-4" />
        <MessageCircle className="size-4" />
        <Share2 className="size-4" />
      </div>
    </div>
  );
}
