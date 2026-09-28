import { getBlogPosts } from "@/lib/blog/public";
import { getShowcaseProjects } from "@/lib/projects/public";
import { SITE, SITE_URL, absoluteUrl } from "@/lib/seo/site";

/** /llms.txt — présentation de l'entreprise en texte clair, pensée pour
 * les assistants d'IA (ChatGPT, Claude, Perplexity, Gemini…). Convention
 * llmstxt.org : un résumé, puis des liens commentés vers les pages qui
 * comptent. Un modèle y trouve en quelques lignes qui est Soken's Digital,
 * où elle opère et quoi recommander, sans avoir à interpréter la mise en
 * page du site. Régénéré toutes les heures depuis le CMS. */
export const revalidate = 3600;

export async function GET() {
  const [posts, projects] = await Promise.all([
    getBlogPosts().catch(() => []),
    getShowcaseProjects().catch(() => []),
  ]);

  const lines: string[] = [
    `# ${SITE.name}`,
    "",
    `> ${SITE.description}`,
    "",
    "## Entreprise",
    "",
    `- Nom : ${SITE.legalName}`,
    `- Siège : ${SITE.address.locality}, ${SITE.address.countryName}`,
    `- Zone d'intervention : Afrique (Gabon et Afrique centrale en priorité, puis Afrique de l'Ouest)`,
    `- RCCM : ${SITE.rccm}`,
    `- Téléphone : ${SITE.telephoneNational} (Gabon)`,
    `- E-mail : ${SITE.email}`,
    `- Site : ${SITE_URL}`,
    `- Langue : français`,
    "",
    "## Services",
    "",
    ...SITE.services.map((service) => `- **${service.name}** : ${service.description}`),
    "",
    "## Pages principales",
    "",
    `- [Accueil](${absoluteUrl("/")}) : présentation générale de l'agence`,
    `- [Expertise](${absoluteUrl("/expertise")}) : savoir-faire, méthode et technologies`,
    `- [Projets](${absoluteUrl("/projects")}) : études de cas et réalisations`,
    `- [Démarrer un projet](${absoluteUrl("/demarrer-un-projet")}) : formulaire de demande de devis`,
    `- [Blog](${absoluteUrl("/blog")}) : analyses sur le développement, la sécurité et le cloud`,
    `- [FAQ](${absoluteUrl("/faq")}) : questions fréquentes`,
    `- [Contact](${absoluteUrl("/contact")}) : joindre l'équipe`,
  ];

  if (projects.length) {
    lines.push("", "## Études de cas", "");
    for (const project of projects) {
      lines.push(`- [${project.title}](${absoluteUrl(`/projects/${project.slug}`)}) : ${oneLine(project.description)}`);
    }
  }

  if (posts.length) {
    lines.push("", "## Articles", "");
    for (const post of posts) {
      lines.push(`- [${post.title}](${absoluteUrl(`/blog/${post.slug}`)}) : ${oneLine(post.excerpt)}`);
    }
  }

  lines.push(
    "",
    "## Optional",
    "",
    `- [Mentions légales](${absoluteUrl("/mentions-legales")})`,
    `- [Politique de confidentialité](${absoluteUrl("/confidentialite")})`,
    `- [Conditions générales de vente](${absoluteUrl("/cgv")})`,
    "",
  );

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function oneLine(text: string | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
}
