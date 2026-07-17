import Link from "next/link";
import { Share2 } from "lucide-react";
import type { BlogPost } from "@/lib/blog/types";
import { CopyLinkButton } from "@/components/blog/copy-link-button";
import { NewsletterForm } from "@/components/blog/newsletter-form";

type Props = {
  tags: string[];
  relatedPosts: BlogPost[];
};

export function ArticleSidebar({ tags, relatedPosts }: Props) {
  return (
    <aside className="space-y-6">
      <div>
        <span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Partager cet article
        </span>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href="https://www.linkedin.com/sharing/share-offsite/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Share2 className="size-3.5" />
            LinkedIn
          </a>
          <CopyLinkButton />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-card/60 p-5">
        <h3 className="text-base font-semibold text-foreground">Restez Sécurisé</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Recevez nos dernières analyses techniques directement dans votre
          boîte mail.
        </p>
        <NewsletterForm />
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/70">
          En vous abonnant, vous acceptez notre politique de confidentialité
          et de gestion des données.
        </p>
      </div>

      <div>
        <span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Sujets connexes
        </span>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-foreground/80"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {relatedPosts.length > 0 && (
        <div>
          <span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            Lecture recommandée
          </span>
          <div className="mt-3 space-y-3">
            {relatedPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex gap-3 rounded-xl border border-white/10 bg-card/60 p-3 transition-colors hover:border-primary/30"
              >
                <div
                  aria-hidden
                  className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[radial-gradient(circle_at_70%_30%,color-mix(in_oklch,var(--primary),transparent_78%),transparent_65%),linear-gradient(160deg,oklch(0.17_0.02_235),oklch(0.08_0.01_240))]"
                >
                  <post.visualIcon className="size-6 text-primary/60 transition-transform duration-300 group-hover:scale-110" />
                </div>
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold text-primary">
                    {post.title}
                  </h4>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {post.excerpt}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
