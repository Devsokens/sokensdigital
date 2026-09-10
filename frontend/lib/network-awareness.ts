/**
 * Lit ce que le navigateur sait de la qualité de la connexion, pour
 * décider quoi charger — image basse résolution, média différé.
 *
 * `navigator.connection` (Network Information API) n'existe que sur
 * Chromium (Chrome, Edge, Android WebView) ; Safari et Firefox ne
 * l'exposent pas. Sans elle, on suppose une connexion correcte plutôt que
 * de dégrader l'expérience de la moitié des navigateurs par précaution —
 * l'absence de signal n'est pas un signal de mauvaise connexion.
 */

interface NetworkInformation extends EventTarget {
  saveData?: boolean;
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
}

function getConnection(): NetworkInformation | undefined {
  if (typeof navigator === "undefined") return undefined;
  const nav = navigator as Navigator & {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
}

/**
 * Vrai si l'utilisateur a explicitement demandé d'économiser les données
 * (réglage "Mode économie de données" du navigateur ou du système), ou si
 * la connexion est classée 2G/slow-2G. Les deux signaux justifient la même
 * décision — servir moins de données — donc traités ensemble plutôt que
 * de dupliquer la logique à chaque appelant.
 */
export function prefersReducedData(): boolean {
  const connection = getConnection();
  if (!connection) return false;
  if (connection.saveData) return true;
  return connection.effectiveType === "2g" || connection.effectiveType === "slow-2g";
}

/**
 * S'abonne aux changements de connexion (l'utilisateur entre dans un tunnel,
 * le WiFi bascule sur la 3G du téléphone). Renvoie un nettoyeur, ou une
 * fonction vide si l'API n'existe pas sur ce navigateur — l'appelant n'a
 * pas à tester les deux cas séparément.
 */
export function onNetworkChange(callback: () => void): () => void {
  const connection = getConnection();
  if (!connection) return () => undefined;
  connection.addEventListener("change", callback);
  return () => connection.removeEventListener("change", callback);
}
