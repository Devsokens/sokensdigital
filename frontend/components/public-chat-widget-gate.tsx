"use client";

import { usePathname } from "next/navigation";
import { SupportChatWidget } from "@/components/support-chat-widget";

/** Keeps the support chat widget off the admin space — it's meant for
 * anonymous site visitors, not staff (who already have internal
 * messaging). */
export function PublicChatWidgetGate() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <SupportChatWidget />;
}
