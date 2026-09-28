/** Injecte un ou plusieurs blocs JSON-LD dans la page (rendu serveur).
 * `<` est échappé : un titre ou un extrait CMS contenant `</script>` ne
 * doit jamais pouvoir refermer la balise et injecter du HTML. */
export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
