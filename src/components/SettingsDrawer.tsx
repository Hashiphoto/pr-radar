import { useEffect, useRef, useState } from 'react';
import type { Settings } from '../../shared/types.js';
import { CloseIcon } from './Icons.js';

export interface SettingsDrawerProps {
  settings: Settings;
  stateFile: string;
  onClose: () => void;
  onChange: (patch: Partial<Settings>) => void;
}

export const SettingsDrawer = ({ settings, stateFile, onClose, onChange }: SettingsDrawerProps) => {
  const [vipDraft, setVipDraft] = useState('');
  const [orgDraft, setOrgDraft] = useState('');
  const vipInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    vipInputRef.current?.focus();
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
                checked={settings.hideBotReviews}
                onChange={(event) => onChange({ hideBotReviews: event.target.checked })}
              />
              <span className="switch-text">
                <strong>Ignore bot reviews</strong>
                <span>Keep CodeRabbit and friends out of the approval counts.</span>
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
            <span className="field-label">State file</span>
            <p className="hint">
              <code>{stateFile}</code>
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
