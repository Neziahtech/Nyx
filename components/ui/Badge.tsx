import type { ReactNode } from "react";

/** Small pill badge on the pale blush highlight. */
export function Badge({
  children,
  tone = "blush",
}: {
  children: ReactNode;
  tone?: "blush" | "success" | "danger" | "neutral";
}) {
  const tones = {
    blush: "bg-blush-100 text-blush-600",
    success: "bg-success/10 text-success",
    danger: "bg-danger/10 text-danger",
    neutral: "bg-blush-100 text-dim",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
