"use client";

import { Button } from "@/components/ui/button";

export function NewsletterForm() {
  return (
    <form onSubmit={(e) => e.preventDefault()} className="mt-4 flex flex-col gap-2">
      <input
        type="email"
        placeholder="votre@email.com"
        className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none"
      />
      <Button
        type="submit"
        className="h-10 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        S&apos;abonner à l&apos;Insight
      </Button>
    </form>
  );
}
