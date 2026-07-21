import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import dynamicIconImports from "lucide-react/dynamicIconImports";

/** Accepts either the icon picker's kebab-case names ("layout-grid") or the
 * PascalCase names seeded by the original data migration ("LayoutGrid") —
 * both resolve to the same icon. Shared between the admin editor
 * (components/admin/marketing/icon-picker.tsx) and the public site
 * (components/sections/services.tsx) so both render identically. */
export function normalizeIconName(name: string): IconName {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase() as IconName;
}

export function SectionIcon({ name, className }: { name: string; className?: string }) {
  const normalized = normalizeIconName(name || "layout-grid");
  if (!dynamicIconImports[normalized]) {
    return <DynamicIcon name="layout-grid" className={className} />;
  }
  return <DynamicIcon name={normalized} className={className} />;
}
