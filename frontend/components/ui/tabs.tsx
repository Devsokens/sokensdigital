"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;
export const TabsPanel = TabsPrimitive.Panel;

export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <TabsPrimitive.List
      className={cn("relative flex gap-1 overflow-x-auto border-b border-neutral-200 pb-px", className)}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTab({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsPrimitive.Tab
      value={value}
      className={cn(
        "relative shrink-0 px-4 py-2.5 text-sm font-medium text-neutral-500 transition-colors",
        "hover:text-neutral-900",
        "data-[selected]:text-primary"
      )}
    >
      {children}
    </TabsPrimitive.Tab>
  );
}

export function TabsIndicator() {
  return (
    <TabsPrimitive.Indicator className="absolute bottom-0 left-0 h-0.5 w-[var(--active-tab-width)] translate-x-[var(--active-tab-left)] rounded-full bg-primary transition-all duration-300" />
  );
}
