/* eslint-disable @next/next/no-img-element */
import { cover, type Album } from "@/lib/format";

type Props = {
  album: Pick<Album, "cover_small" | "cover_medium" | "cover_xl" | "title">;
  size: "44" | "64" | "76" | "96" | "full" | "hero";
  /** Covers next to the album title are decorative; standalone covers need alt text. */
  decorative?: boolean;
};

export function Cover({ album, size, decorative = true }: Props) {
  const src = cover(album, size === "hero" || size === "full" ? "xl" : size === "96" || size === "76" ? "m" : "s");
  const cls = `cover cover-${size}`;
  if (!src) return <div className={cls} aria-hidden="true" />;
  return (
    <img
      src={src}
      alt={decorative ? "" : `Cover of ${album.title}`}
      className={cls}
      loading="lazy"
      width={size === "hero" ? 340 : size === "full" ? 250 : Number(size)}
      height={size === "hero" ? 340 : size === "full" ? 250 : Number(size)}
    />
  );
}
