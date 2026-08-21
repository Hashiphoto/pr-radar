import { useCallback, useEffect, useRef, useState } from 'react';
import type { Group, PullRequest } from '../shared/types.js';
import { useLocalStorage } from './hooks.js';

export interface NotificationControls {
  isSupported: boolean;
  isBlocked: boolean;
  isOn: boolean;
  enable: () => Promise<void>;
  disable: () => void;
}

export interface GroupMembership {
  group: Group;
  prs: PullRequest[];
}

const isSupported = typeof window !== 'undefined' && 'Notification' in window;

const currentPermission = (): NotificationPermission =>
  isSupported ? Notification.permission : 'denied';

// Redefining a group changes what belongs in it, so the signature is part of the key: a new
// signature reseeds silently instead of announcing every PR the new definition sweeps in.
const signatureOf = (group: Group): string =>
  `${group.id}|${group.scope}|${[...group.tags].sort().join(',')}`;

const show = (title: string, body: string, tag: string, icon: string | undefined, url?: string) => {
  const notification = new Notification(title, { body, tag, icon });
  notification.onclick = () => {
    window.focus();
    if (url) window.open(url, '_blank', 'noopener');
    notification.close();
  };
};

const describe = (pullRequest: PullRequest): string =>
  `${pullRequest.author?.login ?? 'Someone'} · ${pullRequest.title}`;

const announce = (group: Group, arrivals: PullRequest[]) => {
  const [first] = arrivals;
  if (!first) return;

  if (arrivals.length === 1) {
    show(
      `New in ${group.name}`,
      `${describe(first)}\n${first.repository} #${first.number}`,
      `${group.id}:${first.id}`,
      first.author?.avatarUrl,
      first.url,
    );
    return;
  }

  show(
    `${arrivals.length} new in ${group.name}`,
    arrivals.map(describe).join('\n'),
    `${group.id}:${arrivals.map((pullRequest) => pullRequest.id).join(',')}`,
    undefined,
  );
};

export const useGroupNotifications = (
  membership: GroupMembership[] | undefined,
): NotificationControls => {
  const [isEnabled, setIsEnabled] = useLocalStorage('pr-radar.notificationsEnabled', false);
  const [permission, setPermission] = useState<NotificationPermission>(currentPermission);
  const announcedRef = useRef(new Map<string, Set<string>>());

  const isOn = isSupported && isEnabled && permission === 'granted';

  const enable = useCallback(async () => {
    if (!isSupported) return;
    const granted =
      Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    setPermission(granted);
    setIsEnabled(granted === 'granted');
  }, [setIsEnabled]);

  const disable = useCallback(() => setIsEnabled(false), [setIsEnabled]);

  useEffect(() => {
    if (!membership) return;

    const announced = announcedRef.current;
    const next = new Map<string, Set<string>>();
    const pending: GroupMembership[] = [];

    for (const entry of membership) {
      const key = signatureOf(entry.group);
      const ids = entry.prs.map((pullRequest) => pullRequest.id);
      const before = announced.get(key);
      next.set(key, new Set(before ? [...before, ...ids] : ids));

      // The first sighting of a group only seeds its baseline: those PRs are already on screen.
      if (!before || !isOn || !entry.group.notifyOnNew) continue;

      const arrivals = entry.prs.filter((pullRequest) => !before.has(pullRequest.id));
      if (arrivals.length > 0) pending.push({ group: entry.group, prs: arrivals });
    }

    announcedRef.current = next;
    for (const entry of pending) announce(entry.group, entry.prs);
  }, [isOn, membership]);

  return { isSupported, isBlocked: isSupported && permission === 'denied', isOn, enable, disable };
};
