function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

type Props = {
  client: string;
  technologies: string[];
  timeline: string;
  leadName: string;
  leadRole: string;
};

export function TechnicalSpecs({ client, technologies, timeline, leadName, leadRole }: Props) {
  return (
    <aside className="h-fit rounded-2xl border border-white/10 bg-card/60 p-5">
      <h3 className="text-base font-semibold text-foreground">Technical Specs</h3>

      <div className="mt-5">
        <span className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Client
        </span>
        <p className="mt-1 text-sm font-medium text-foreground">{client}</p>
      </div>

      <div className="mt-4">
        <span className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Technologies
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {technologies.map((tech) => (
            <span
              key={tech}
              className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] font-medium text-foreground"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <span className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Calendrier
        </span>
        <p className="mt-1 text-sm text-foreground">{timeline}</p>
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <span className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Chef de Projet
        </span>
        <div className="mt-2 flex items-center gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {initials(leadName)}
          </span>
          <span>
            <span className="block text-sm font-medium text-foreground">{leadName}</span>
            <span className="block text-xs text-muted-foreground">{leadRole}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
