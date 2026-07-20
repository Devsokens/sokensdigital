// Shared Tailwind class strings for the admin area's light theme. The rest
// of the site (marketing pages) stays dark — see app/admin/layout.tsx for
// where the split happens. `text-primary`/`bg-primary` (brand cyan) are
// reused as-is: they read fine on white and that's the point of keeping
// "the current color" for accents per the design brief.

export const inputClass =
  "w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-primary/50 focus:outline-none";

export const readOnlyInputClass =
  "w-full rounded-lg border border-neutral-100 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-500";

export const cardClass = "rounded-xl border border-neutral-200 bg-white p-5 shadow-sm";

export const labelClass = "mb-1.5 block text-xs text-neutral-500";
