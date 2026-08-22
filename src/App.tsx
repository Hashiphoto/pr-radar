import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { columnValuesFor, matchesFilters } from '../shared/columns.js';
import type { PullRequest, Settings, Snapshot } from '../shared/types.js';
import * as api from './api.js';
import { clockTime, timeUntil } from './format.js';
import { useLocalStorage, useTheme, useTick } from './hooks.js';
import type { PrEntry } from './entries.js';
import { useGroupNotifications, type GroupMembership } from './notifications.js';
import { GearIcon, GroupsIcon, HelpIcon, MoonIcon, RefreshIcon, SunIcon } from './components/Icons.js';
import { GroupEditorModal } from './components/GroupEditorModal.js';
import { HelpModal } from './components/HelpModal.js';
import { GroupRow } from './components/GroupRow.js';
import { DEFAULT_WIDTHS, PrTable } from './components/PrTable.js';
import { Section } from './components/Section.js';
import { ServiceFooter } from './components/ServiceFooter.js';
import { SettingsDrawer } from './components/SettingsDrawer.js';
import { moveGroup } from './groups.js';
import { useReorder } from './reorder.js';

const matchesSearch = (pullRequest: PullRequest, term: string): boolean => {
  if (!term) return true;
  const haystack = [
    pullRequest.title,
    pullRequest.repository,
    pullRequest.author?.login ?? '',
    `#${pullRequest.number}`,
    ...pullRequest.labels.map((label) => label.name),
  ]
    .join(' ')
    .toLowerCase();

  return term
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
};

// Settings that only change how the client renders what it already has, so saving them must not
// spend a GitHub request.
const clientOnlySettings = new Set<string>(['groups', 'jiraBaseUrl', 'pollSeconds']);

const allPrs = (snapshot: Snapshot): PullRequest[] => [
  ...snapshot.incoming,
  ...snapshot.mine,
  ...snapshot.dismissed,
];

const byOldestFirst = (left: PullRequest, right: PullRequest): number =>
  Date.parse(left.createdAt) - Date.parse(right.createdAt);

export const App = () => {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stateFile, setStateFile] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [repoFilter, setRepoFilter] = useState('all');
  const [showDismissed, setShowDismissed] = useLocalStorage('pr-radar.showDismissed', false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isGroupEditorOpen, setIsGroupEditorOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [collapsed, setCollapsed] = useLocalStorage<Record<string, boolean>>('pr-radar.collapsed', {});
  const [widths, setWidths] = useLocalStorage<Record<string, number>>(
    'pr-radar.columnWidths',
    DEFAULT_WIDTHS,
  );
  const { theme, toggleTheme } = useTheme();
  const searchRef = useRef<HTMLInputElement>(null);

  useTick(30_000);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setSnapshot(await api.fetchSnapshot());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load pull requests');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    api
      .fetchSettings()
      .then((result) => {
        setSettings(result.settings);
        setStateFile(result.stateFile);
      })
      .catch(() => setSettings(null));
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!settings) return;
    const timer = window.setInterval(() => void refresh(), settings.pollSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [refresh, settings]);

  const applySettings = useCallback(
    async (patch: Partial<Settings>) => {
      const optimistic = settings ? { ...settings, ...patch } : null;
      if (optimistic) setSettings(optimistic);

      try {
        const result = await api.updateSettings(patch);
        setSettings(result.settings);
        if (Object.keys(patch).some((key) => !clientOnlySettings.has(key))) await refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Failed to save settings');
      }
    },
    [refresh, settings],
  );

  const toggleVip = useCallback(
    (login: string) => {
      if (!settings) return;
      const isVip = settings.vips.some((entry) => entry.toLowerCase() === login.toLowerCase());
      void applySettings({
        vips: isVip
          ? settings.vips.filter((entry) => entry.toLowerCase() !== login.toLowerCase())
          : [...settings.vips, login],
      });
    },
    [applySettings, settings],
  );

  const dismiss = useCallback(
    async (pullRequest: PullRequest) => {
      setSnapshot((current) =>
        current
          ? {
              ...current,
              incoming: current.incoming.filter((entry) => entry.id !== pullRequest.id),
              dismissed: [pullRequest, ...current.dismissed],
            }
          : current,
      );

      try {
        await api.dismissPr({
          id: pullRequest.id,
          url: pullRequest.url,
          title: pullRequest.title,
          repository: pullRequest.repository,
          number: pullRequest.number,
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Failed to dismiss');
        await refresh();
      }
    },
    [refresh],
  );

  const restore = useCallback(
    async (pullRequest: PullRequest) => {
      setSnapshot((current) =>
        current
          ? {
              ...current,
              dismissed: current.dismissed.filter((entry) => entry.id !== pullRequest.id),
              incoming: [pullRequest, ...current.incoming],
            }
          : current,
      );

      try {
        await api.restorePr(pullRequest.id);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Failed to restore');
        await refresh();
      }
    },
    [refresh],
  );

  const patchGroup = useCallback(
    (id: string, changes: Partial<Settings['groups'][number]>) => {
      if (!settings) return;
      void applySettings({
        groups: settings.groups.map((group) => (group.id === id ? { ...group, ...changes } : group)),
      });
    },
    [applySettings, settings],
  );

  const removeGroup = useCallback(
    (id: string) => {
      if (!settings) return;
      setEditingGroupId(null);
      void applySettings({ groups: settings.groups.filter((group) => group.id !== id) });
    },
    [applySettings, settings],
  );

  const reorderGroups = useCallback(
    (from: number, to: number) => {
      if (!settings) return;
      void applySettings({ groups: moveGroup(settings.groups, from, to) });
    },
    [applySettings, settings],
  );

  const groupIds = useMemo(() => (settings?.groups ?? []).map((group) => group.id), [settings]);
  const reorder = useReorder(groupIds, reorderGroups);

  // Every group renders its own table, so the widths live here: dragging one heading has to move
  // the same column in all of them or the page stops reading as one table.
  const resizeColumn = useCallback(
    (column: string, width: number) =>
      setWidths((current) => ({ ...current, [column]: Math.round(width) })),
    [setWidths],
  );

  const toggleSection = useCallback(
    (key: string) => setCollapsed((current) => ({ ...current, [key]: !current[key] })),
    [setCollapsed],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target ? ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) : false;

      if (event.key === 'Escape' && isTyping) {
        (target as HTMLInputElement).blur();
        return;
      }
      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'r') {
        event.preventDefault();
        void refresh();
      } else if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === 'd') {
        event.preventDefault();
        setShowDismissed((current) => !current);
      } else if (event.key === ',') {
        event.preventDefault();
        setIsSettingsOpen(true);
      } else if (event.key === 'g') {
        event.preventDefault();
        setIsGroupEditorOpen(true);
      } else if (event.key === '?') {
        event.preventDefault();
        setIsHelpOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [refresh, setShowDismissed]);

  const repositories = useMemo(
    () => (snapshot ? [...new Set(allPrs(snapshot).map((pullRequest) => pullRequest.repository))].sort() : []),
    [snapshot],
  );

  const reviewRequestIds = useMemo(
    () =>
      new Set(
        snapshot ? [...snapshot.incoming, ...snapshot.dismissed].map((pullRequest) => pullRequest.id) : [],
      ),
    [snapshot],
  );

  const dismissedIds = useMemo(
    () => new Set(snapshot ? snapshot.dismissed.map((pullRequest) => pullRequest.id) : []),
    [snapshot],
  );

  const visible = useCallback(
    (entries: PrEntry[]) =>
      entries.filter(
        (entry) =>
          matchesSearch(entry.pullRequest, search) &&
          (repoFilter === 'all' || entry.pullRequest.repository === repoFilter) &&
          (showDismissed || !dismissedIds.has(entry.pullRequest.id)),
      ),
    [dismissedIds, repoFilter, search, showDismissed],
  );

  // Every column value a row shows is also what its group filters on, so they are derived once and
  // handed to both rather than recomputed per group.
  const entriesById = useMemo<Map<string, PrEntry>>(() => {
    if (!snapshot) return new Map();

    const vips = new Set((settings?.vips ?? []).map((login) => login.toLowerCase()));
    const viewer = snapshot.viewer.login.toLowerCase();

    return new Map(
      allPrs(snapshot).map((pullRequest) => {
        const login = (pullRequest.author?.login ?? '').toLowerCase();
        return [
          pullRequest.id,
          {
            pullRequest,
            values: columnValuesFor(pullRequest, {
              isMine: login === viewer,
              isVip: vips.has(login),
            }),
          },
        ];
      }),
    );
  }, [settings, snapshot]);

  const entriesFor = useCallback(
    (list: PullRequest[]): PrEntry[] =>
      list.flatMap((pullRequest) => {
        const entry = entriesById.get(pullRequest.id);
        return entry ? [entry] : [];
      }),
    [entriesById],
  );

  // Membership is deliberately unfiltered: the search box must not look like PRs arrived or left,
  // because this is also what drives group notifications.
  const membership = useMemo<GroupMembership[] | undefined>(() => {
    if (!snapshot || !settings) return undefined;

    // Set-aside pull requests stay in the groups they belong to and are hidden by the toggle
    // instead, so a group's definition means the same thing whether or not the toggle is on.
    const requests = [...snapshot.incoming, ...snapshot.dismissed].sort(byOldestFirst);
    const requestIds = new Set(requests.map((pullRequest) => pullRequest.id));

    // Every group reads the same list and says who it wants in the Author column, so a pull request
    // that is both mine and awaiting me is one row rather than two.
    const relevant = [
      ...requests,
      ...snapshot.mine.filter((pullRequest) => !requestIds.has(pullRequest.id)),
    ];

    return settings.groups.map((group) => ({
      group,
      entries: entriesFor(relevant).filter((entry) => matchesFilters(entry.values, group.filters)),
    }));
  }, [entriesFor, settings, snapshot]);

  const notifications = useGroupNotifications(membership);

  const shownGroups = (membership ?? []).map((entry) => ({
    group: entry.group,
    entries: visible(entry.entries),
  }));
  const shownTotal = shownGroups.reduce((total, entry) => total + entry.entries.length, 0);

  const renderTable = (entries: PrEntry[]) => (
    <PrTable
      entries={entries}
      reviewRequestIds={reviewRequestIds}
      dismissedIds={dismissedIds}
      jiraBaseUrl={settings?.jiraBaseUrl ?? ''}
      botReviewComment={settings?.botReviewComment ?? ''}
      widths={widths}
      onResize={resizeColumn}
      onToggleVip={toggleVip}
      onDismiss={dismiss}
      onRestore={restore}
    />
  );

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          PR Radar
          {snapshot && <span>updated {clockTime(snapshot.fetchedAt)}</span>}
        </div>
        <div className="topbar-spacer" />
        {snapshot && (
          <div className="viewer-chip" title={`Signed in as ${snapshot.viewer.login}`}>
            <img src={snapshot.viewer.avatarUrl} alt="" />
            {snapshot.viewer.login}
          </div>
        )}
        <button
          type="button"
          className="icon-button"
          onClick={() => void refresh()}
          disabled={isRefreshing}
          title="Refresh (r)"
        >
          <RefreshIcon className={isRefreshing ? 'spin' : undefined} />
        </button>
        <button type="button" className="icon-button" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => setIsHelpOpen(true)}
          title="What the columns mean (?)"
        >
          <HelpIcon />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => setIsSettingsOpen(true)}
          title="Settings (,)"
        >
          <GearIcon />
        </button>
      </header>

      <div className="toolbar">
        <div className="search">
          <input
            ref={searchRef}
            type="search"
            placeholder="Filter by title, repo, author, label…   /"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select className="select" value={repoFilter} onChange={(event) => setRepoFilter(event.target.value)}>
          <option value="all">All repositories</option>
          {repositories.map((repository) => (
            <option key={repository} value={repository}>
              {repository}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`icon-button${showDismissed ? ' is-active' : ''}`}
          onClick={() => setShowDismissed((current) => !current)}
          title="Show the pull requests you have set aside, in the groups they belong to (d)"
        >
          Not reviewing
          {snapshot && snapshot.dismissed.length > 0 ? ` (${snapshot.dismissed.length})` : ''}
        </button>
      </div>

      {error && (
        <div className="banner">
          <div>
            <strong>Could not reach GitHub.</strong> {error}
          </div>
        </div>
      )}

      {snapshot?.warnings.length ? (
        <div className="banner is-warning">
          <div>
            <strong>GitHub returned partial results.</strong> {snapshot.warnings.join(' · ')}
          </div>
        </div>
      ) : null}

      {!snapshot && !error && (
        <div className="card-list">
          {[0, 1, 2, 3, 4].map((index) => (
            <div className="skeleton" key={index} />
          ))}
        </div>
      )}

      {snapshot && (
        <>
          {shownGroups.map((entry, index) => (
            <Section
              key={entry.group.id}
              title={entry.group.name}
              count={entry.entries.length}
              variant={entry.group.notifyOnNew ? 'vip' : 'default'}
              hue={entry.group.hue}
              notifies={entry.group.notifyOnNew}
              isCollapsed={Boolean(collapsed[entry.group.id])}
              onToggle={() => toggleSection(entry.group.id)}
              isSettingsOpen={editingGroupId === entry.group.id}
              onOpenSettings={() =>
                setEditingGroupId((current) => (current === entry.group.id ? null : entry.group.id))
              }
              drag={{
                isDragging: reorder.draggingId === entry.group.id,
                isDropBefore: reorder.dropIndex === index,
                isDropAfter:
                  reorder.dropIndex === shownGroups.length && index === shownGroups.length - 1,
                ref: reorder.register(entry.group.id),
                onPointerDown: reorder.onPointerDown(entry.group.id),
              }}
              panel={
                editingGroupId === entry.group.id ? (
                  <div className="group-panel">
                    <GroupRow
                      group={entry.group}
                      isPickerOpen
                      onPatch={(changes) => patchGroup(entry.group.id, changes)}
                      onRemove={() => removeGroup(entry.group.id)}
                    />
                    <p className="hint is-tight">Drag a group heading to reorder the page.</p>
                  </div>
                ) : null
              }
            >
              {entry.entries.length > 0 ? (
                renderTable(entry.entries)
              ) : (
                <div className="empty">Nothing in this group right now.</div>
              )}
            </Section>
          ))}

          {settings?.groups.length === 0 && (
            <div className="zero-state">
              <strong>You have no groups.</strong>
              <button
                type="button"
                className="primary-button"
                onClick={() => setIsGroupEditorOpen(true)}
              >
                Add one
              </button>
            </div>
          )}

          {shownTotal === 0 && (search || repoFilter !== 'all') && (
            <div className="zero-state">
              <strong>No pull requests match that filter.</strong>
              Clear the search or pick a different repository.
            </div>
          )}

          <div className="page-actions">
            <button
              type="button"
              className="wide-row-button"
              onClick={() => setIsGroupEditorOpen(true)}
              title="Add, rename, retag and reorder your groups (g)"
            >
              <GroupsIcon />
              Edit groups
              <kbd>g</kbd>
            </button>
          </div>

          <div className="meta-line">
            {snapshot.rateLimit && (
              <span>
                GitHub API {snapshot.rateLimit.remaining}/{snapshot.rateLimit.limit} remaining, resets in{' '}
                {timeUntil(snapshot.rateLimit.resetAt)}
              </span>
            )}
            {settings && <span>· auto refresh every {settings.pollSeconds}s</span>}
            <span>
              · <kbd>r</kbd> refresh <kbd>/</kbd> search <kbd>d</kbd> dismissed <kbd>g</kbd> groups{' '}
              <kbd>,</kbd> settings <kbd>?</kbd> help
            </span>
          </div>
        </>
      )}

      <ServiceFooter />

      {isSettingsOpen && settings && (
        <SettingsDrawer
          settings={settings}
          stateFile={stateFile}
          notifications={notifications}
          onClose={() => setIsSettingsOpen(false)}
          onChange={(patch) => void applySettings(patch)}
          onEditGroups={() => setIsGroupEditorOpen(true)}
        />
      )}

      {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}

      {isGroupEditorOpen && settings && (
        <GroupEditorModal
          groups={settings.groups}
          onSave={(groups) => void applySettings({ groups })}
          onClose={() => setIsGroupEditorOpen(false)}
        />
      )}
    </div>
  );
};
