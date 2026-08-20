import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { DismissedEntry, Settings } from '../shared/types.js';

interface PersistedState {
  settings: Settings;
  dismissed: DismissedEntry[];
}

export const defaultSettings: Settings = {
  vips: [],
  pollSeconds: 120,
  orgs: [],
  includeTeamRequests: true,
  hideBotReviews: true,
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
      hideBotReviews: settings.hideBotReviews ?? base.settings.hideBotReviews,
    },
    dismissed: Array.isArray(parsed.dismissed)
      ? parsed.dismissed.filter((entry): entry is DismissedEntry => typeof entry?.id === 'string')
      : base.dismissed,
  };
};

let state: PersistedState | null = null;

const persist = async (next: PersistedState) => {
  await mkdir(dirname(stateFile), { recursive: true });
  const scratch = `${stateFile}.${process.pid}.tmp`;
  await writeFile(scratch, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await rename(scratch, stateFile);
  state = next;
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
