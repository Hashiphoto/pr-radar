import { useCallback, useState } from 'react';
import type { ColumnDefinition } from '../../shared/columns.js';
import { useDismissOnOutside } from '../hooks.js';
import { ChevronIcon } from './Icons.js';

const summarize = (column: ColumnDefinition, selected: string[]): string => {
  if (selected.length === 0) return 'All';
  const labels = column.values
    .filter((value) => selected.includes(value.id))
    .map((value) => value.label);
  return labels.length <= 2 ? labels.join(', ') : `${labels.length} of ${column.values.length}`;
};

export interface ColumnFilterProps {
  column: ColumnDefinition;
  selected: string[];
  onChange: (selected: string[]) => void;
}

export const ColumnFilter = ({ column, selected, onChange }: ColumnFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);
  const rootRef = useDismissOnOutside<HTMLDivElement>(isOpen, close);

  // Stored in column order rather than click order, so the summary reads the same as the menu.
  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((value) => value !== id)
      : column.values.map((value) => value.id).filter((value) => value === id || selected.includes(value));
    onChange(next.length === column.values.length ? [] : next);
  };

  return (
    <div className="column-filter" ref={rootRef}>
      <span className="column-filter-label">{column.label}</span>
      <button
        type="button"
        className={`column-filter-button${selected.length > 0 ? ' is-set' : ''}`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="column-filter-value">{summarize(column, selected)}</span>
        <ChevronIcon size={12} />
      </button>

      {isOpen && (
        <div className="column-filter-menu" role="group" aria-label={column.label}>
          <button
            type="button"
            className={`column-filter-option${selected.length === 0 ? ' is-on' : ''}`}
            onClick={() => onChange([])}
          >
            <span className="column-filter-box" />
            All
          </button>
          {column.values.map((value) => (
            <button
              type="button"
              key={value.id}
              className={`column-filter-option${selected.includes(value.id) ? ' is-on' : ''}`}
              onClick={() => toggle(value.id)}
            >
              <span className="column-filter-box" />
              <span className={`pill is-${value.tone}`} title={value.rule}>
                {value.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
