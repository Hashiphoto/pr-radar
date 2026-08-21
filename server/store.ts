import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { filtersFromTags, normalizeFilters } from '../shared/columns.js';
import type { DismissedEntry, Group, GroupScope, Settings } from '../shared/types.js';

interface PersistedState {
  settings: Settings;
  dismissed: DismissedEntry[];
}

export const defaultGroups: Group[] = [
  {
    id: 'vip',
    name: 'VIP review requests',
    scope: 'incoming',
    filters: { author: ['vip'] },
    notifyOnNew: true,
  },
  {
    id: 'incoming',
    name: 'Review requested',
    scope: 'incoming',
    filters: { author: ['other'] },
    notifyOnNew: false,
  },
  {
    id: 'mine',
    name: 'My pull requests',
    scope: 'mine',
    filters: { status: ['draft', 'ready'] },
    notifyOnNew: false,
  },
];

export const defaultSettings: Settings = {
  vips: [],
  pollSeconds: 120,
  orgs: [],
  includeTeamRequests: true,
  jiraBaseUrl: '',
  botReviewComment: '@coderabbitai review',
  groups: defaultGroups,
};

const scopes = new Set<GroupScope>(['incoming', 'mine', 'all']);

const isScope = (value: unknown): value is GroupScope => scopes.has(value as GroupScope);

// Groups saved before the column filters were tags, and a group that silently matched nothing
// would read as an empty queue, so the old tag sets are translated rather than dropped.
const coerceGroup = (raw: unknown, index: number): Group | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const group = raw as Partial<Group> & { tags?: unknown };
  if (typeof group.name !== 'string' || group.name.trim().length === 0) return null;

  return {
    id: typeof group.id === 'string' && group.id.length > 0 ? group.id : `group-${index}`,
    name: group.name.trim(),
    scope: isScope(group.scope) ? group.scope : 'all',
    filters: group.filters ? normalizeFilters(group.filters) : filtersFromTags(group.tags),
    notifyOnNew: group.notifyOnNew === true,
  };
};

const coerceGroups = (raw: unknown, fallback: Group[]): Group[] => {
  if (!Array.isArray(raw)) return fallback;
  const groups = raw.map(coerceGroup).filter((group): group is Group => group !== null);
  return [...new Map(groups.map((group) => [group.id, group])).values()];
};

const stateFile =
  process.env.PR_RADAR_STATE ??
  join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'pr-radar', 'state.json');

const emptyState = (): PersistedState => ({ settings: { ...defaultSettings }, dismissed: [] });

const coerce = (raw: unknown): PersistedState => {
  const base = emptyState();
  if (typeof raw !== 'object' || raw === null) return base;

  const parsed = raw as Partial<PersistedState>;
  const settings: Partial<Settings> = parsed.settings ?? {};

  return {
    settings: {
      vips: Array.isArray(settings.vips) ? settings.vips.filter((login) => typeof login === 'string') : base.settings.vips,
      pollSeconds:
        typeof settings.pollSeconds === 'number' && settings.pollSeconds >= 15
          ? settings.pollSeconds
          : base.settings.pollSeconds,
      orgs: Array.isArray(settings.orgs) ? settings.orgs.filter((org) => typeof org === 'string') : base.settings.orgs,
      includeTeamRequests: settings.includeTeamRequests ?? base.settings.includeTeamRequests,
      jiraBaseUrl: typeof settings.jiraBaseUrl === 'string' ? settings.jiraBaseUrl : base.settings.jiraBaseUrl,
      botReviewComment:
        typeof settings.botReviewComment === 'string'
          ? settings.botReviewComment
          : base.settings.botReviewComment,
      groups: coerceGroups(settings.groups, base.settings.groups),
    },
    dismissed: Array.isArray(parsed.dismissed)
      ? parsed.dismissed.filter((entry): entry is DismissedEntry => typeof entry?.id === 'string')
      : base.dismissed,
  };
};

let state: PersistedState | null = null;
let queue: Promise<unknown> = Promise.resolve();
let scratchCount = 0;

const write = async (next: PersistedState) => {
  await mkdir(dirname(stateFile), { recursive: true });
  scratchCount += 1;
  const scratch = `${stateFile}.${process.pid}.${scratchCount}.tmp`;
  await writeFile(scratch, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await rename(scratch, stateFile);
  state = next;
};

// The editor saves on every keystroke and tag click, so overlapping writes are the norm rather
// than the exception: they are queued, and each gets its own scratch file to rename from.
const persist = (next: PersistedState): Promise<void> => {
  const settled = queue.then(() => write(next));
  queue = settled.catch(() => undefined);
  return settled;
};

export const loadState = async (): Promise<PersistedState> => {
  if (state) return state;

  try {
    state = coerce(JSON.parse(await readFile(stateFile, 'utf8')));
  } catch {
    state = emptyState();
  }

  return state;
};

export const getSettings = async (): Promise<Settings> => (await loadState()).settings;

export const saveSettings = async (patch: Partial<Settings>): Promise<Settings> => {
  const current = await loadState();
  const normalizedVips = patch.vips
    ? [...new Set(patch.vips.map((login) => login.trim().replace(/^@/, '')).filter(Boolean))]
    : current.settings.vips;
  const normalizedOrgs = patch.orgs
    ? [...new Set(patch.orgs.map((org) => org.trim()).filter(Boolean))]
    : current.settings.orgs;

  const next: PersistedState = {
    ...current,
    settings: {
      ...current.settings,
      ...patch,
      vips: normalizedVips,
      orgs: normalizedOrgs,
      groups: patch.groups ? coerceGroups(patch.groups, current.settings.groups) : current.settings.groups,
      jiraBaseUrl: (patch.jiraBaseUrl ?? current.settings.jiraBaseUrl).trim(),
      botReviewComment: (patch.botReviewComment ?? current.settings.botReviewComment).trim(),
      pollSeconds: Math.max(15, Math.round(patch.pollSeconds ?? current.settings.pollSeconds)),
    },
  };

  await persist(next);
  return next.settings;
};

export const getDismissed = async (): Promise<DismissedEntry[]> => (await loadState()).dismissed;

export const addDismissed = async (entry: Omit<DismissedEntry, 'dismissedAt'>): Promise<DismissedEntry[]> => {
  const current = await loadState();
  const withoutDuplicate = current.dismissed.filter((existing) => existing.id !== entry.id);
  const next: PersistedState = {
    ...current,
    dismissed: [...withoutDuplicate, { ...entry, dismissedAt: new Date().toISOString() }],
  };

  await persist(next);
  return next.dismissed;
};

export const removeDismissed = async (id: string): Promise<DismissedEntry[]> => {
  const current = await loadState();
  const next: PersistedState = {
    ...current,
    dismissed: current.dismissed.filter((entry) => entry.id !== id),
  };

  await persist(next);
  return next.dismissed;
};

export const pruneDismissed = async (liveIds: Set<string>): Promise<void> => {
  const current = await loadState();
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const kept = current.dismissed.filter(
    (entry) => liveIds.has(entry.id) || Date.parse(entry.dismissedAt) > cutoff,
  );

  if (kept.length !== current.dismissed.length) {
    await persist({ ...current, dismissed: kept });
  }
};

export const stateFilePath = stateFile;
