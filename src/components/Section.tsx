import type { ReactNode } from 'react';
import { ChevronIcon } from './Icons.js';

export interface SectionProps {
  title: string;
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
  variant?: 'default' | 'vip';
  children: ReactNode;
}

export const Section = ({ title, count, isCollapsed, onToggle, variant = 'default', children }: SectionProps) => (
  <section className={`section${variant === 'vip' ? ' is-vip' : ''}`}>
    <button type="button" className="section-head" onClick={onToggle} aria-expanded={!isCollapsed}>
      <h2>{title}</h2>
      <span className="count">{count}</span>
      <ChevronIcon className={`chevron${isCollapsed ? ' is-collapsed' : ''}`} />
    </button>
    {!isCollapsed && children}
  </section>
);
