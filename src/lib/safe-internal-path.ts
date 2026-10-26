/** Resolve an untrusted post-authentication destination to a same-origin path. */
export function safeInternalPath(
  candidate: string | null | undefined,
  origin: string,
  fallback = "/account",
): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(candidate)) {
    return fallback;
  }

  try {
    const target = new URL(candidate, origin);
    if (target.origin !== origin) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
