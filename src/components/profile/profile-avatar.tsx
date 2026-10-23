"use client";

import { useState } from "react";

const sizes = {
  sm: "size-10 text-sm",
  md: "size-16 text-xl",
  lg: "size-24 text-3xl sm:size-28 sm:text-4xl",
} as const;

/**
 * Аватар с текстовым запасным вариантом. Если картинка не загрузилась
 * (битая ссылка), показывается первая буква имени, а не пустой круг.
 */
export function ProfileAvatar({
  name,
  url,
  size = "md",
  className = "",
}: {
  name: string;
  url: string | null | undefined;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(url) && failedUrl !== url;
  const initial = (name.trim().slice(0, 1) || "?").toUpperCase();

  return (
    <span
      role="img"
      aria-label={`Аватар: ${name}`}
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-accent-strong/30 font-bold text-accent ${sizes[size]} ${className}`}
    >
      {showImage ? (
        // Аватары — пользовательские ссылки, поэтому без allowlist хостов для next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url!} alt="" onError={() => setFailedUrl(url ?? null)} className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initial}</span>
      )}
    </span>
  );
}
