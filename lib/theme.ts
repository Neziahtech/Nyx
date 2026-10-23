/**
 * The single source of truth for brand colors in non-Tailwind contexts
 * (canvas/SVG props like the QR code). These values must stay in sync with
 * the blush tokens in `tailwind.config.ts`; components must not invent new
 * hex values.
 */
export const BRAND_ROSE = "#D9606F"; // blush-500
export const SURFACE_WHITE = "#FFFFFF";
