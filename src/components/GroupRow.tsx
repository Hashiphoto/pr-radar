import { COLUMNS, describeFilters } from '../../shared/columns.js';
import type { Group, GroupScope } from '../../shared/types.js';
import { ColumnFilter } from './ColumnFilter.js';
import { ArrowDownIcon, ArrowUpIcon, CloseIcon } from './Icons.js';

export interface GroupRowProps {
  group: Group;
  isPickerOpen: boolean;
  onTogglePicker?: () => void;
  onPatch: (changes: Partial<Group>) => void;
  onRemove: () => void;
  onMove?: (offset: number) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export const scopeLabels: Record<GroupScope, string> = {
  incoming: 'Awaiting my review',
  mine: 'Authored by me',
  all: 'Everything',
};

const narrowedCount = (group: Group): number =>
  COLUMNS.filter((column) => (group.filters[column.id] ?? []).length > 0).length;

export const GroupRow = ({
  group,
  isPickerOpen,
  onTogglePicker,
  onPatch,
  onRemove,
  onMove,
  canMoveUp = false,
  canMoveDown = false,
}: GroupRowProps) => (
  <div className={`group-row${isPickerOpen ? ' is-open' : ''}`}>
    <div className="group-head">
      {onMove && (
        <div className="group-order">
          <button
            type="button"
            className="icon-button is-tiny"
            title="Move up"
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
          >
            <ArrowUpIcon />
          </button>
          <button
            type="button"
            className="icon-button is-tiny"
            title="Move down"
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
          >
            <ArrowDownIcon />
          </button>
        </div>
      )}

      <input
        className="text-input"
        value={group.name}
        aria-label="Group name"
        onChange={(event) => onPatch({ name: event.target.value })}
      />

      <button
        type="button"
        className="icon-button is-danger"
        title={`Remove ${group.name}`}
        onClick={onRemove}
      >
        <CloseIcon size={12} />
      </button>
    </div>

    <div className="group-meta">
      <select
        className="select is-compact"
        value={group.scope}
        aria-label="Which pull requests this group draws from"
        onChange={(event) => onPatch({ scope: event.target.value as GroupScope })}
      >
        {Object.entries(scopeLabels).map(([scope, label]) => (
          <option key={scope} value={scope}>
            {label}
          </option>
        ))}
      </select>

      <label className="inline-check">
        <input
          type="checkbox"
          checked={group.notifyOnNew}
          onChange={(event) => onPatch({ notifyOnNew: event.target.checked })}
        />
        Notify
      </label>

      {onTogglePicker && (
        <button type="button" className="link-button" onClick={onTogglePicker}>
          {isPickerOpen ? 'Done' : `Columns (${narrowedCount(group)})`}
        </button>
      )}
    </div>

    <p className="hint is-tight">{describeFilters(group.filters)}</p>

    {isPickerOpen && (
      <div className="filter-picker">
        {COLUMNS.map((column) => (
          <ColumnFilter
            key={column.id}
            column={column}
            selected={group.filters[column.id] ?? []}
            onChange={(selected) =>
              onPatch({ filters: { ...group.filters, [column.id]: selected } })
            }
          />
        ))}
      </div>
    )}
  </div>
);
