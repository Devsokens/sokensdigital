"use client";

import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* Menu ouvert au clic droit (ou appui long sur mobile), même habillage que
 * PopoverContent (components/ui/popover.tsx) pour que les deux menus
 * d'actions d'un écran se ressemblent. */

const POPUP_CLASS = cn(
  "z-50 min-w-52 rounded-xl border border-neutral-200 bg-white p-1 shadow-xl shadow-black/5 outline-hidden",
  "origin-[var(--transform-origin)] transition-[transform,opacity] duration-100",
  "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
  "data-[ending-style]:scale-95 data-[ending-style]:opacity-0"
);

const ITEM_CLASS =
  "flex w-full cursor-default items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-neutral-700 outline-hidden select-none data-[highlighted]:bg-neutral-100 data-[disabled]:opacity-40";

type TriggerProps = React.ComponentProps<typeof ContextMenuPrimitive.Trigger>;

export function ContextMenu({
  children,
  menu,
  ...triggerProps
}: TriggerProps & {
  /** Contenu du menu : des ContextMenuItem, séparateurs et sous-menus. */
  menu: React.ReactNode;
}) {
  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger {...triggerProps}>{children}</ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Positioner className="z-50 outline-hidden">
          <ContextMenuPrimitive.Popup className={POPUP_CLASS}>{menu}</ContextMenuPrimitive.Popup>
        </ContextMenuPrimitive.Positioner>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  );
}

export function ContextMenuItem({
  icon: Icon,
  children,
  destructive,
  className,
  ...props
}: Omit<React.ComponentProps<typeof ContextMenuPrimitive.Item>, "className"> & {
  className?: string;
  icon?: React.ComponentType<{ className?: string }>;
  destructive?: boolean;
}) {
  return (
    <ContextMenuPrimitive.Item
      {...props}
      className={cn(ITEM_CLASS, destructive && "text-destructive data-[highlighted]:bg-destructive/5", className)}
    >
      {Icon && <Icon className="size-3.5 shrink-0" />}
      {children}
    </ContextMenuPrimitive.Item>
  );
}

export function ContextMenuSeparator() {
  return <ContextMenuPrimitive.Separator className="mx-1 my-1 h-px bg-neutral-100" />;
}

export function ContextMenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="truncate px-2.5 pt-1.5 pb-1 text-[0.65rem] font-semibold tracking-wide text-neutral-400 uppercase">
      {children}
    </p>
  );
}

export function ContextMenuSubmenu({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <ContextMenuPrimitive.SubmenuRoot>
      <ContextMenuPrimitive.SubmenuTrigger className={cn(ITEM_CLASS, "data-[popup-open]:bg-neutral-100")}>
        {Icon && <Icon className="size-3.5 shrink-0" />}
        {label}
        <ChevronRight className="ml-auto size-3.5 text-neutral-400" />
      </ContextMenuPrimitive.SubmenuTrigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Positioner className="z-50 outline-hidden" alignOffset={-4} sideOffset={2}>
          <ContextMenuPrimitive.Popup className={POPUP_CLASS}>{children}</ContextMenuPrimitive.Popup>
        </ContextMenuPrimitive.Positioner>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.SubmenuRoot>
  );
}
