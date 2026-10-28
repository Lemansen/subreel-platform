"use client";

import { useEffect, useState, type ReactNode } from "react";

export function CatalogResultsGrid({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const start = () => setLoading(true);
    window.addEventListener("subreel:catalog-loading", start);
    return () => window.removeEventListener("subreel:catalog-loading", start);
  }, []);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setLoading(false));
    return () => window.cancelAnimationFrame(frame);
  }, [children]);
  return (
    <div aria-busy={loading} className={`mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 transition-opacity duration-200 ${loading ? "pointer-events-none opacity-45" : "opacity-100"}`}>
      {children}
    </div>
  );
}
