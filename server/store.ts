import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { filtersFromScope, filtersFromTags, normalizeFilters } from '../shared/columns.js';
import { normalizeHue } from '../shared/hue.js';
import type { DismissedEntry, Group, Settings } from '../shared/types.js';
import defaults from './defaults.json' with { type: 'json' };

interface PersistedState {
  settings: Settings;
  dismissed: DismissedEntry[];
}

// Every group in defaults.json is a box in the column grid, and together they tile it: any open
// pull request matches exactly one. The bots listed there review as a plain User, so neither the
// Bot type nor a `[bot]` login suffix gives them away.
export const defaultSettings: Settings = defaults;

// GitHub logins are matched case-insensitively, so two spellings of one account are one entry:
// keeping both would put a duplicate chip on the panel that no amount of removing clears.
// Zero is off rather than a floor to clamp up: an interval of a few seconds is a way to burn the
// GitHub rate limit, but "do not poll at all" is a real answer.
const normalizePollSeconds = (seconds: number): number => {
  if (!Number.isFinite(seconds)) return defaultSettings.pollSeconds;
  const rounded = Math.round(seconds);
  return rounded <= 0 ? 0 : Math.max(15, rounded);
};

const normalizeLogins = (logins: string[]): string[] => {
  const byKey = new Map<string, string>();

  for (const raw of logins) {
    const login = raw.trim().replace(/^@/, '');
    const key = login.toLowerCase();
    if (login.length > 0 && !byKey.has(key)) byKey.set(key, login);
  }

  return [...byKey.values()];
};

// Groups saved before the column filters were tags, and before a scope was an Author value, and a
// group that silently matched nothing would read as an empty queue, so both are translated rather
// than dropped.
const coerceGroup = (raw: unknown, index: number): Group | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const group = raw as Partial<Group> & { tags?: unknown; scope?: unknown };
  if (typeof group.name !== 'string' || group.name.trim().length === 0) return null;

  const filters = group.filters ? normalizeFilters(group.filters) : filtersFromTags(group.tags);

  return {
    id: typeof group.id === 'string' && group.id.length > 0 ? group.id : `group-${index}`,
    name: group.name.trim(),
    filters: filtersFromScope(filters, group.scope),
    notifyOnNew: group.notifyOnNew === true,
    hue: normalizeHue(group.hue),
  };
};

const coerceGroups = (raw: unknown, fallback: Group[]): Group[] => {
  if (!Array.isArray(raw)) return fallback;
  const groups = raw.map(coerceGroup).filter((group): group is Group => group !== null);
  return [...new Map(groups.map((group) => [group.id, group])).values()];
};

const configFile =
  process.env.PR_RADAR_CONFIG ??
  join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'pr-radar', 'config.json');

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
        typeof settings.pollSeconds === 'number'
          ? normalizePollSeconds(settings.pollSeconds)
          : base.settings.pollSeconds,
      orgs: Array.isArray(settings.orgs) ? settings.orgs.filter((org) => typeof org === 'string') : base.settings.orgs,
      includeTeamRequests: settings.includeTeamRequests ?? base.settings.includeTeamRequests,
      jiraBaseUrl: typeof settings.jiraBaseUrl === 'string' ? settings.jiraBaseUrl : base.settings.jiraBaseUrl,
      botReviewComment:
        typeof settings.botReviewComment === 'string'
          ? settings.botReviewComment
          : base.settings.botReviewComment,
      bots: Array.isArray(settings.bots)
        ? settings.bots.filter((login) => typeof login === 'string')
        : base.settings.bots,
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
  await mkdir(dirname(configFile), { recursive: true });
  scratchCount += 1;
  const scratch = `${configFile}.${process.pid}.${scratchCount}.tmp`;
  await writeFile(scratch, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await rename(scratch, configFile);
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
    state = coerce(JSON.parse(await readFile(configFile, 'utf8')));
  } catch {
    state = emptyState();
  }

  return state;
};

export const getSettings = async (): Promise<Settings> => (await loadState()).settings;

export const saveSettings = async (patch: Partial<Settings>): Promise<Settings> => {
  const current = await loadState();
  const normalizedVips = patch.vips ? normalizeLogins(patch.vips) : current.settings.vips;
  const normalizedBots = patch.bots ? normalizeLogins(patch.bots) : current.settings.bots;
  const normalizedOrgs = patch.orgs
    ? [...new Set(patch.orgs.map((org) => org.trim()).filter(Boolean))]
    : current.settings.orgs;

  // Every field is named rather than spread from the patch, because an imported config file is
  // arbitrary JSON and unknown keys have no business reaching the config file.
  const next: PersistedState = {
    ...current,
    settings: {
      vips: normalizedVips,
      orgs: normalizedOrgs,
      includeTeamRequests: patch.includeTeamRequests ?? current.settings.includeTeamRequests,
      groups: patch.groups ? coerceGroups(patch.groups, current.settings.groups) : current.settings.groups,
      jiraBaseUrl: (patch.jiraBaseUrl ?? current.settings.jiraBaseUrl).trim(),
      botReviewComment: (patch.botReviewComment ?? current.settings.botReviewComment).trim(),
      bots: normalizedBots,
      pollSeconds: normalizePollSeconds(patch.pollSeconds ?? current.settings.pollSeconds),
    },
  };

  await persist(next);
  return next.settings;
};

// Set-aside pull requests are not a setting and survive the reset, the same way importing a
// config file leaves them alone.
export const resetSettings = async (): Promise<Settings> => {
  const current = await loadState();
  const next: PersistedState = { ...current, settings: { ...defaultSettings } };

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

export const configFilePath = configFile;
