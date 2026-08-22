import type { ReactNode } from 'react';
import { hueStyle } from '../groups.js';
import { BellIcon, ChevronIcon, GearIcon } from './Icons.js';

export interface SectionProps {
  title: string;
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
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
  isCollapsed,
  onToggle,
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

      <div className="section-controls">
        {onOpenSettings && (
          <button
            type="button"
            className={`icon-button is-tiny-square${isSettingsOpen ? ' is-active' : ''}`}
            title={isSettingsOpen ? 'Close group settings' : `Settings for ${title}`}
            onClick={onOpenSettings}
          >
            <GearIcon size={14} />
          </button>
        )}
        <button
          type="button"
          className="icon-button is-tiny-square"
          aria-expanded={!isCollapsed}
          title={isCollapsed ? `Show ${title}` : `Hide ${title}`}
          onClick={onToggle}
        >
          <ChevronIcon className={`chevron${isCollapsed ? ' is-collapsed' : ''}`} />
        </button>
      </div>
    </div>
    {panel}
    {!isCollapsed && children}
  </section>
);
