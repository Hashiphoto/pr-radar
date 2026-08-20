import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MyPrBucket, PullRequest, Settings, Snapshot } from '../shared/types.js';
import * as api from './api.js';
import { clockTime, timeUntil } from './format.js';
import { useLocalStorage, useTheme, useTick } from './hooks.js';
import { GearIcon, MoonIcon, RefreshIcon, SunIcon } from './components/Icons.js';
import { PrCard } from './components/PrCard.js';
import { Section } from './components/Section.js';
import { ServiceFooter } from './components/ServiceFooter.js';
import { SettingsDrawer } from './components/SettingsDrawer.js';

const bucketOrder: MyPrBucket[] = ['changesRequested', 'awaitingReview', 'approved', 'draft'];

const bucketMeta: Record<MyPrBucket, { label: string; dot: string }> = {
  draft: { label: 'Draft', dot: 'is-draft' },
  awaitingReview: { label: 'Awaiting review', dot: 'is-awaiting' },
  changesRequested: { label: 'Changes requested', dot: 'is-changes' },
  approved: { label: 'Approved', dot: 'is-approved' },
};

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

const allPrs = (snapshot: Snapshot): PullRequest[] => [
  ...snapshot.vipReviews,
  ...snapshot.incomingReviews,
  ...snapshot.dismissedReviews,
  ...bucketOrder.flatMap((bucket) => snapshot.myPrs[bucket]),
];

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
  const [collapsed, setCollapsed] = useLocalStorage<Record<string, boolean>>('pr-radar.collapsed', {});
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
        await refresh();
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
              vipReviews: current.vipReviews.filter((entry) => entry.id !== pullRequest.id),
              incomingReviews: current.incomingReviews.filter((entry) => entry.id !== pullRequest.id),
              dismissedReviews: [pullRequest, ...current.dismissedReviews],
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
              dismissedReviews: current.dismissedReviews.filter((entry) => entry.id !== pullRequest.id),
              vipReviews: pullRequest.isVip ? [pullRequest, ...current.vipReviews] : current.vipReviews,
              incomingReviews: pullRequest.isVip
                ? current.incomingReviews
                : [pullRequest, ...current.incomingReviews],
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
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [refresh, setShowDismissed]);

  const repositories = useMemo(
    () => (snapshot ? [...new Set(allPrs(snapshot).map((pullRequest) => pullRequest.repository))].sort() : []),
    [snapshot],
  );

  const visible = useCallback(
    (list: PullRequest[]) =>
      list.filter(
        (pullRequest) =>
          matchesSearch(pullRequest, search) &&
          (repoFilter === 'all' || pullRequest.repository === repoFilter),
      ),
    [repoFilter, search],
  );

  const isVipAuthor = useCallback(
    (pullRequest: PullRequest) =>
      Boolean(
        settings?.vips.some((entry) => entry.toLowerCase() === (pullRequest.author?.login ?? '').toLowerCase()),
      ),
    [settings],
  );

  const vipReviews = snapshot ? visible(snapshot.vipReviews) : [];
  const incomingReviews = snapshot ? visible(snapshot.incomingReviews) : [];
  const dismissedReviews = snapshot ? visible(snapshot.dismissedReviews) : [];
  const myBuckets = snapshot
    ? bucketOrder.map((bucket) => ({ bucket, prs: visible(snapshot.myPrs[bucket]) }))
    : [];
  const myTotal = myBuckets.reduce((total, group) => total + group.prs.length, 0);
  const hasAnything = vipReviews.length + incomingReviews.length + myTotal > 0;

  const renderCards = (list: PullRequest[], mode: 'incoming' | 'mine' | 'dismissed') =>
    list.map((pullRequest) => (
      <PrCard
        key={pullRequest.id}
        pullRequest={pullRequest}
        showRequestSource={mode !== 'mine'}
        isVipAuthor={isVipAuthor(pullRequest)}
        {...(mode !== 'mine' ? { onToggleVip: toggleVip } : {})}
        {...(mode === 'incoming' ? { onDismiss: dismiss } : {})}
        {...(mode === 'dismissed' ? { onRestore: restore } : {})}
      />
    ));

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
          title="Show the PRs you have set aside (d)"
        >
          Not reviewing
          {snapshot && snapshot.dismissedReviews.length > 0 ? ` (${snapshot.dismissedReviews.length})` : ''}
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
          {settings && settings.vips.length > 0 && (
            <Section
              title="VIP review requests"
              count={vipReviews.length}
              variant="vip"
              isCollapsed={Boolean(collapsed.vip)}
              onToggle={() => toggleSection('vip')}
            >
              {vipReviews.length > 0 ? (
                <div className="card-list">{renderCards(vipReviews, 'incoming')}</div>
              ) : (
                <div className="empty">Nothing from your VIPs right now.</div>
              )}
            </Section>
          )}

          <Section
            title="Review requested"
            count={incomingReviews.length}
            isCollapsed={Boolean(collapsed.incoming)}
            onToggle={() => toggleSection('incoming')}
          >
            {incomingReviews.length > 0 ? (
              <div className="card-list">{renderCards(incomingReviews, 'incoming')}</div>
            ) : (
              <div className="empty">Your review queue is empty. Nice.</div>
            )}
          </Section>

          <Section
            title="My pull requests"
            count={myTotal}
            isCollapsed={Boolean(collapsed.mine)}
            onToggle={() => toggleSection('mine')}
          >
            {myTotal > 0 ? (
              myBuckets
                .filter((group) => group.prs.length > 0)
                .map((group) => (
                  <div className="subgroup" key={group.bucket}>
                    <div className="subgroup-head">
                      <span className={`dot ${bucketMeta[group.bucket].dot}`} />
                      {bucketMeta[group.bucket].label}
                      <span className="count">{group.prs.length}</span>
                    </div>
                    <div className="card-list">{renderCards(group.prs, 'mine')}</div>
                  </div>
                ))
            ) : (
              <div className="empty">No open pull requests of your own.</div>
            )}
          </Section>

          {showDismissed && (
            <Section
              title="Not reviewing"
              count={dismissedReviews.length}
              isCollapsed={Boolean(collapsed.dismissed)}
              onToggle={() => toggleSection('dismissed')}
            >
              {dismissedReviews.length > 0 ? (
                <div className="card-list">{renderCards(dismissedReviews, 'dismissed')}</div>
              ) : (
                <div className="empty">You have not set anything aside.</div>
              )}
            </Section>
          )}

          {!hasAnything && (search || repoFilter !== 'all') && (
            <div className="zero-state">
              <strong>No pull requests match that filter.</strong>
              Clear the search or pick a different repository.
            </div>
          )}

          <div className="meta-line">
            {snapshot.rateLimit && (
              <span>
                GitHub API {snapshot.rateLimit.remaining}/{snapshot.rateLimit.limit} remaining, resets in{' '}
                {timeUntil(snapshot.rateLimit.resetAt)}
              </span>
            )}
            {settings && <span>· auto refresh every {settings.pollSeconds}s</span>}
            <span>
              · <kbd>r</kbd> refresh <kbd>/</kbd> search <kbd>d</kbd> dismissed <kbd>,</kbd> settings
            </span>
          </div>
        </>
      )}

      <ServiceFooter />

      {isSettingsOpen && settings && (
        <SettingsDrawer
          settings={settings}
          stateFile={stateFile}
          onClose={() => setIsSettingsOpen(false)}
          onChange={(patch) => void applySettings(patch)}
        />
      )}
    </div>
  );
};
