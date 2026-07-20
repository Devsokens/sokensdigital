"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

export function SheetContent({
  className,
  children,
  title,
}: {
  className?: string;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
        )}
      />
      <Dialog.Popup
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl",
          "transition-transform duration-300 ease-out",
          "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <Dialog.Title className="text-base font-semibold text-neutral-900">
            {title}
          </Dialog.Title>
          <Dialog.Close
            aria-label="Fermer"
            className="rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-900"
          >
            <X className="size-4" />
          </Dialog.Close>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </Dialog.Popup>
    </Dialog.Portal>
  );
}
