import { Suspense } from "react";
import { Chat } from "@/components/admin/messaging/chat";

export default function MessageriePage() {
  // Suspense : la messagerie lit ?room= (lien d'une notification de message).
  return (
    <Suspense>
      <Chat />
    </Suspense>
  );
}
