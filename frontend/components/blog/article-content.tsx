import { cn } from "@/lib/utils";
import type { Block, Tone } from "@/lib/blog/types";
import { CodeBlock } from "@/components/blog/code-block";

const TONE_CLASSES: Record<Tone, string> = {
  medium: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  high: "border-orange-500/30 bg-orange-500/15 text-orange-400",
  critical: "border-red-500/30 bg-red-500/15 text-red-400",
};

function ToneBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        TONE_CLASSES[tone]
      )}
    >
      {label}
    </span>
  );
}

export function ArticleContent({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "p":
            return (
              <p key={i} className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                {block.text}
              </p>
            );

          case "h2":
            return (
              <h2
                key={i}
                className="pt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
              >
                {block.text}
              </h2>
            );

          case "h3":
            return (
              <h3
                key={i}
                className={cn(
                  "pt-2 text-lg font-semibold tracking-tight text-foreground sm:text-xl",
                  block.center && "text-center"
                )}
              >
                {block.text}
              </h3>
            );

          case "code":
            return <CodeBlock key={i} filename={block.filename} code={block.code} />;

          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03]">
                      {block.headers.map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-xs font-semibold tracking-wide text-foreground uppercase"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, ri) => (
                      <tr
                        key={ri}
                        className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                      >
                        {row.cells.map((cell, ci) => (
                          <td key={ci} className="px-4 py-3 text-muted-foreground">
                            {cell}
                          </td>
                        ))}
                        {row.tone && (
                          <td className="px-4 py-3">
                            <ToneBadge tone={row.tone} label={row.tone} />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case "compare":
            return (
              <div key={i} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[block.left, block.right].map((side, si) => (
                  <div
                    key={si}
                    className={cn(
                      "rounded-xl border-l-2 bg-card/60 p-4",
                      side.accent === "cyan" ? "border-primary" : "border-amber-400/70"
                    )}
                  >
                    <h4
                      className={cn(
                        "text-sm font-semibold",
                        side.accent === "cyan" ? "text-primary" : "text-amber-400"
                      )}
                    >
                      {side.title}
                    </h4>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {side.description}
                    </p>
                  </div>
                ))}
              </div>
            );

          case "callout":
            return (
              <div
                key={i}
                className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <block.icon className="size-4" />
                </span>
                <h4 className="text-sm font-semibold text-foreground">{block.title}</h4>
                <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                  {block.description}
                </p>
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
