export function ArticleContent({ html }: { html: string }) {
  return (
    <div
      className="space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-white/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_h2]:pt-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:pt-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-foreground [&_li]:leading-relaxed [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:leading-relaxed [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-white/[0.03] [&_pre]:p-4 [&_pre]:text-xs [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5 sm:[&_h2]:text-2xl sm:[&_h3]:text-xl"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
