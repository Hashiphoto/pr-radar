const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

export const relativeAge = (isoDate: string): string => {
  const elapsed = Date.now() - Date.parse(isoDate);

  if (elapsed < minute) return 'just now';
  if (elapsed < hour) return `${Math.floor(elapsed / minute)}m`;
  if (elapsed < day) return `${Math.floor(elapsed / hour)}h`;
  if (elapsed < 30 * day) return `${Math.floor(elapsed / day)}d`;
  return `${Math.floor(elapsed / (30 * day))}mo`;
};

export const timeUntil = (isoDate: string): string => {
  const remaining = Date.parse(isoDate) - Date.now();

  if (remaining <= 0) return 'now';
  if (remaining < minute) return `${Math.ceil(remaining / 1000)}s`;
  if (remaining < hour) return `${Math.ceil(remaining / minute)}m`;
  return `${Math.round(remaining / hour)}h`;
};

export const staleness = (isoDate: string): 'fresh' | 'aging' | 'stale' => {
  const elapsed = Date.now() - Date.parse(isoDate);
  if (elapsed > 7 * day) return 'stale';
  if (elapsed > 2 * day) return 'aging';
  return 'fresh';
};

export const clockTime = (isoDate: string): string =>
  new Date(isoDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const compactNumber = (value: number): string =>
  value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
