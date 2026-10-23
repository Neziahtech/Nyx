import type { ReactNode } from "react";

/** White card with a subtle rose border; the basic surface everywhere. */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-blush-200 bg-white p-5 shadow-card ${className}`}
    >
      {children}
    </section>
  );
}

/** Card heading, in the deep neutral text color. */
export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-base font-semibold text-ink">{children}</h2>;
}
