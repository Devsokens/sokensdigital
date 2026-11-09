/** Image de couverture d'un article, posée par-dessus le visuel abstrait
 * de la carte (qui reste le repli quand l'article n'a pas d'image). */
export function CoverImage({ src }: { src?: string }) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className="sd-zoom"
      style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", zIndex: 1 }}
    />
  );
}
