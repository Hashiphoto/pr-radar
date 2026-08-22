import type { CSSProperties } from 'react';
import type { Group } from '../shared/types.js';

export const nextGroupId = (groups: Group[]): string => {
  const taken = new Set(groups.map((group) => group.id));
  for (let index = groups.length + 1; ; index += 1) {
    const candidate = `group-${index}`;
    if (!taken.has(candidate)) return candidate;
  }
};

// `to` is an index into the list with the moved group already taken out of it.
export const moveGroup = (groups: Group[], from: number, to: number): Group[] => {
  const moved = groups[from];
  if (!moved || to < 0 || to >= groups.length) return groups;
  const without = groups.filter((_, index) => index !== from);
  return [...without.slice(0, to), moved, ...without.slice(to)];
};

// A group's hue reaches CSS as a custom property, so every tinted element derives its colors from
// the same rules instead of each computing its own.
export const hueStyle = (hue: number | null): CSSProperties | undefined =>
  hue === null ? undefined : ({ '--group-hue': hue } as CSSProperties);
