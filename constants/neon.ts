/**
 * Neon series for categorical bar charts, in an order that keeps neighbours far apart in hue.
 * Values are CSS variables from app/globals.css; every bar also prints its value and label,
 * so colour is never the only cue.
 */
export const NEON_SERIES = [
  "var(--neon-blue)",
  "var(--neon-mint)",
  "var(--neon-pink)",
  "var(--neon-amber)",
  "var(--neon-cyan)",
  "var(--neon-violet)",
  "var(--neon-orange)",
  "var(--primary)",
] as const
