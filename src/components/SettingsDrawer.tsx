import { useEffect, useRef, useState } from 'react';
import type { Settings } from '../../shared/types.js';
import type { NotificationControls } from '../notifications.js';
import { CloseIcon } from './Icons.js';

export interface SettingsDrawerProps {
  settings: Settings;
  stateFile: string;
  notifications: NotificationControls;
  onClose: () => void;
  onChange: (patch: Partial<Settings>) => void;
  onEditGroups: () => void;
}

const notificationHint = (notifications: NotificationControls): string => {
  if (!notifications.isSupported) return 'This browser cannot show desktop notifications.';
  if (notifications.isBlocked)
    return 'Notifications are blocked for this site. Allow them in your browser, then reload.';
  return 'Groups marked Notify raise a desktop notification when a pull request lands in them. Only while this tab is open.';
};

export const SettingsDrawer = ({
  settings,
  stateFile,
  notifications,
  onClose,
  onChange,
  onEditGroups,
}: SettingsDrawerProps) => {
  const [vipDraft, setVipDraft] = useState('');
  const [orgDraft, setOrgDraft] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const vipInputRef = useRef<HTMLInputElement>(null);
  const configInputRef = useRef<HTMLInputElement>(null);

  // Autofocus belongs to opening the drawer, not to every render: sharing an effect with the
  // Escape handler stole the caret back on each keystroke elsewhere in the panel.
  useEffect(() => {
    vipInputRef.current?.focus();
  }, []);

  const exportConfig = () => {
    const url = URL.createObjectURL(
      new Blob([`${JSON.stringify(settings, null, 2)}\n`], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pr-radar-config.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = async (file: File) => {
    setImportError(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object');
      onChange(parsed as Partial<Settings>);
    } catch {
      setImportError(`${file.name} is not a PR Radar config file.`);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const addVips = () => {
    const additions = vipDraft
      .split(/[\s,]+/)
      .map((entry) => entry.trim().replace(/^@/, ''))
      .filter(Boolean);

    if (additions.length > 0) {
      onChange({ vips: [...settings.vips, ...additions] });
    }
    setVipDraft('');
  };

  const addOrg = () => {
    const trimmed = orgDraft.trim();
    if (trimmed) onChange({ orgs: [...settings.orgs, trimmed] });
    setOrgDraft('');
  };

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Settings">
        <div className="drawer-head">
          <h2>Settings</h2>
          <div className="topbar-spacer" />
          <button type="button" className="icon-button" onClick={onClose} title="Close (Esc)">
            <CloseIcon />
          </button>
        </div>

        <div className="drawer-body">
          <div className="field">
            <span className="field-label">VIP authors</span>
            <div className="row">
              <input
                ref={vipInputRef}
                className="text-input"
                placeholder="github-login"
                value={vipDraft}
                onChange={(event) => setVipDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addVips();
                  }
                }}
              />
              <button type="button" className="primary-button" onClick={addVips}>
                Add
              </button>
            </div>
            <p className="hint">
              Review requests from these people get their own section at the top. Paste several at once,
              separated by spaces or commas.
            </p>
            <div className="chip-list">
              {settings.vips.length === 0 && <span className="hint">No VIPs yet.</span>}
              {settings.vips.map((login) => (
                <span className="chip" key={login}>
                  {login}
                  <button
                    type="button"
                    title={`Remove ${login}`}
                    onClick={() => onChange({ vips: settings.vips.filter((entry) => entry !== login) })}
                  >
                    <CloseIcon size={11} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field-label">Limit to organizations</span>
            <div className="row">
              <input
                className="text-input"
                placeholder="my-org"
                value={orgDraft}
                onChange={(event) => setOrgDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addOrg();
                  }
                }}
              />
              <button type="button" className="primary-button" onClick={addOrg}>
                Add
              </button>
            </div>
            <p className="hint">Leave empty to search every repository you can see.</p>
            <div className="chip-list">
              {settings.orgs.map((org) => (
                <span className="chip" key={org}>
                  {org}
                  <button
                    type="button"
                    title={`Remove ${org}`}
                    onClick={() => onChange({ orgs: settings.orgs.filter((entry) => entry !== org) })}
                  >
                    <CloseIcon size={11} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field-label">Groups</span>
            <p className="hint">
              Every group is a section on the dashboard, in this order. A pull request shows up in
              each group it matches.
            </p>
            <button type="button" className="primary-button is-wide" onClick={onEditGroups}>
              Edit groups ({settings.groups.length})
            </button>
          </div>

          <div className="field">
            <label htmlFor="jira-base-url">Jira base URL</label>
            <input
              id="jira-base-url"
              className="text-input"
              placeholder="https://your-org.atlassian.net/browse"
              value={settings.jiraBaseUrl}
              onChange={(event) => onChange({ jiraBaseUrl: event.target.value })}
            />
            <p className="hint">
              Set this and each card links the issue key found in its title. Leave it empty to hide
              the link.
            </p>
          </div>

          <div className="field">
            <label htmlFor="bot-review-comment">Ask a bot for review</label>
            <input
              id="bot-review-comment"
              className="text-input"
              placeholder="@coderabbitai review"
              value={settings.botReviewComment}
              onChange={(event) => onChange({ botReviewComment: event.target.value })}
            />
            <p className="hint">
              On a draft whose Bot review is <em>Not requested</em>, that cell becomes a button
              that comments this on the pull request. Leave it empty to hide the button.
            </p>
          </div>

          <div className="field">
            <span className="field-label">Behavior</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.includeTeamRequests}
                onChange={(event) => onChange({ includeTeamRequests: event.target.checked })}
              />
              <span className="switch-text">
                <strong>Include team review requests</strong>
                <span>Show PRs assigned to a team you belong to, not just to you by name.</span>
              </span>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={notifications.isOn}
                disabled={!notifications.isSupported || notifications.isBlocked}
                onChange={(event) =>
                  event.target.checked ? void notifications.enable() : notifications.disable()
                }
              />
              <span className="switch-text">
                <strong>Desktop notifications</strong>
                <span>{notificationHint(notifications)}</span>
              </span>
            </label>
          </div>

          <div className="field">
            <label htmlFor="poll-seconds">Auto refresh</label>
            <select
              id="poll-seconds"
              className="select"
              value={settings.pollSeconds}
              onChange={(event) => onChange({ pollSeconds: Number(event.target.value) })}
            >
              <option value={30}>Every 30 seconds</option>
              <option value={60}>Every minute</option>
              <option value={120}>Every 2 minutes</option>
              <option value={300}>Every 5 minutes</option>
              <option value={900}>Every 15 minutes</option>
            </select>
          </div>

          <div className="field">
            <span className="field-label">Shortcuts</span>
            <p className="hint">
              <kbd>r</kbd> refresh · <kbd>/</kbd> search · <kbd>d</kbd> toggle dismissed ·{' '}
              <kbd>Esc</kbd> close
            </p>
          </div>

          <div className="field">
            <span className="field-label">Config file</span>
            <p className="hint">
              Everything on this panel lives in <code>{stateFile}</code>. Export writes the same
              JSON without your set-aside pull requests, so it is safe to hand to someone else;
              importing replaces every setting in it, groups included.
            </p>
            <div className="row">
              <button type="button" className="icon-button" onClick={exportConfig}>
                Export config
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => configInputRef.current?.click()}
              >
                Import config
              </button>
            </div>
            <input
              ref={configInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const [file] = event.target.files ?? [];
                if (file) void importConfig(file);
                event.target.value = '';
              }}
            />
            {importError && <p className="hint is-bad">{importError}</p>}
          </div>
        </div>
      </aside>
    </>
  );
};
