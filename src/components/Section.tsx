import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { hueStyle } from '../groups.js';
import { BellIcon, ChevronIcon, GearIcon, GripIcon } from './Icons.js';

export interface SectionDrag {
  isDragging: boolean;
  isDropBefore: boolean;
  isDropAfter: boolean;
  ref: (element: HTMLElement | null) => void;
  onPointerDown: (event: ReactPointerEvent) => void;
}

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
  drag?: SectionDrag;
  panel?: ReactNode;
  children: ReactNode;
}

const dragClasses = (drag: SectionDrag | undefined): string => {
  if (!drag) return '';
  return [
    drag.isDragging ? ' is-dragging' : '',
    drag.isDropBefore ? ' is-drop-before' : '',
    drag.isDropAfter ? ' is-drop-after' : '',
  ].join('');
};

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
  drag,
  panel,
  children,
}: SectionProps) => (
  <section
    ref={drag?.ref}
    className={`section${variant === 'vip' ? ' is-vip' : ''}${hue === null ? '' : ' is-tinted'}${dragClasses(drag)}`}
    style={hueStyle(hue)}
  >
    <div className={`section-head${drag ? ' is-draggable' : ''}`} onPointerDown={drag?.onPointerDown}>
      {drag && <GripIcon className="section-grip" />}
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
