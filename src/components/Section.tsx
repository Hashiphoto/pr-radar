import type { ReactNode } from 'react';
import { hueStyle } from '../groups.js';
import { BellIcon, GearIcon } from './Icons.js';

export interface SectionProps {
  title: string;
  count: number;
  variant?: 'default' | 'vip';
  hue?: number | null;
  notifies?: boolean;
  isSettingsOpen?: boolean;
  onOpenSettings?: () => void;
  panel?: ReactNode;
  children: ReactNode;
}

export const Section = ({
  title,
  count,
  variant = 'default',
  hue = null,
  notifies = false,
  isSettingsOpen = false,
  onOpenSettings,
  panel,
  children,
}: SectionProps) => (
  <section
    className={`section${variant === 'vip' ? ' is-vip' : ''}${hue === null ? '' : ' is-tinted'}`}
    style={hueStyle(hue)}
  >
    <div className="section-head">
      <h2>{title}</h2>
      {notifies && <BellIcon className="section-bell" />}
      <span className="count">{count}</span>

      {onOpenSettings && (
        <div className="section-controls">
          <button
            type="button"
            className={`icon-button is-tiny-square${isSettingsOpen ? ' is-active' : ''}`}
            title={isSettingsOpen ? 'Close group settings' : `Settings for ${title}`}
            onClick={onOpenSettings}
          >
            <GearIcon size={14} />
          </button>
        </div>
      )}
    </div>
    {panel}
    {children}
  </section>
);
