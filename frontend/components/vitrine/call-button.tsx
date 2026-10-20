import { Editable } from "./editable";
import { telHref } from "./ui";

/** Bouton d'appel rond : téléphone qui sonne (secousses + ondes). Le numéro
 * n'est pas affiché, il est dans le lien, l'info-bulle et le libellé
 * d'accessibilité ; dans l'éditeur, un clic sur l'icône le modifie. */
export function CallButton({ phone, size, className = "" }: { phone: string; size: number; className?: string }) {
  return (
    <a className={`sd-call ${className}`} href={telHref(phone)} aria-label={`Appeler le ${phone}`} title={`Appeler le ${phone}`} style={{ width: `${size}px`, height: `${size}px` }}>
      <Editable path={{ scope: "settings", key: "contact_phone" }} value={phone} hint="Numéro appelé par ce bouton (il n'est pas affiché).">
        <svg width={Math.round(size * 0.38)} height={Math.round(size * 0.38)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
        </svg>
      </Editable>
    </a>
  );
}
