import { Heart, MessageCircle, Repeat2, Send, Share2, ThumbsUp, Play } from "lucide-react";
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

type Props = {
  platform: SocialPlatform;
  title: string;
  content: string;
  imagePath: string;
};

/** A best-effort visual approximation of how the post will actually look on
 * its target platform — not a pixel-exact clone of each app's UI, just
 * enough real layout/branding to review before publishing (there's no
 * publishing engine yet, see SocialPost's docstring — this is a planning
 * aid, not a live preview). */
export function SocialPostPreview({ platform, title, content, imagePath }: Props) {
  if (platform === "INSTAGRAM") {
    return (
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Avatar className="size-8 text-xs" />
          <p className="text-sm font-semibold text-neutral-900">sokensdigital</p>
        </div>
        <div className="flex aspect-square items-center justify-center bg-neutral-100">
          {imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePath} alt="" className="size-full object-cover" />
          ) : (
            <PlatformIcon platform={platform} className="size-10 text-neutral-300" />
          )}
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

  if (platform === "YOUTUBE") {
    return (
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="relative flex aspect-video items-center justify-center bg-neutral-900">
          {imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePath} alt="" className="size-full object-cover" />
          ) : (
            <PlatformIcon platform={platform} className="size-10 text-white/40" />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-black/50">
              <Play className="size-5 fill-white text-white" />
            </div>
          </div>
        </div>
        <div className="flex gap-2.5 p-3">
          <Avatar className="size-9 text-xs" />
          <div>
            <p className="text-sm leading-snug font-semibold text-neutral-900">{title || "Titre de la vidéo"}</p>
            <p className="text-xs text-neutral-500">Soken&apos;s Digital</p>
          </div>
        </div>
      </div>
    );
  }

  if (platform === "TWITTER") {
    return (
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-3.5">
        <div className="flex gap-2.5">
          <Avatar className="size-10 text-xs" />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-semibold text-neutral-900">Soken&apos;s Digital</span>{" "}
              <span className="text-neutral-500">@sokensdigital</span>
            </p>
            <p className="mt-0.5 text-sm whitespace-pre-wrap text-neutral-900">
              {content || <span className="text-neutral-400">{title || "Contenu du post…"}</span>}
            </p>
            {imagePath && (
              <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePath} alt="" className="max-h-56 w-full object-cover" />
              </div>
            )}
            <div className="mt-3 flex items-center justify-between text-neutral-400">
              <MessageCircle className="size-4" />
              <Repeat2 className="size-4" />
              <Heart className="size-4" />
              <Share2 className="size-4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LinkedIn / Facebook — same "feed card" shape, different accent.
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
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imagePath} alt="" className="max-h-64 w-full object-cover" />
      )}
      <div className="flex items-center gap-4 border-t border-neutral-100 px-3.5 py-2 text-neutral-400">
        <ThumbsUp className="size-4" />
        <MessageCircle className="size-4" />
        <Share2 className="size-4" />
      </div>
    </div>
  );
}
