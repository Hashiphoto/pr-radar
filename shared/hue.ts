export const HUE_MIN = 0;
export const HUE_MAX = 359;

// Where the slider sits for a group that has no color of its own, matching --accent.
export const DEFAULT_HUE = 214;

// A group keeps a hue rather than a color, because the light and dark treatments are both derived
// from it in CSS: a hue picked in one theme cannot come out illegible in the other.
export const normalizeHue = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return ((Math.round(value) % 360) + 360) % 360;
};
