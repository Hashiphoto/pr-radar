import { useEffect, useRef, useState } from 'react';
import { COLUMNS, describeFilters, type GroupFilters } from '../../shared/columns.js';
import type { Group } from '../../shared/types.js';
import { hueStyle } from '../groups.js';
import { ColumnFilter } from './ColumnFilter.js';
import { HuePicker } from './HuePicker.js';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BellIcon,
  BellOffIcon,
  PencilIcon,
  TrashIcon,
} from './Icons.js';

export interface GroupRowProps {
  group: Group;
  isEditing: boolean;
  onToggleEditing?: () => void;
  onPatch: (changes: Partial<Group>) => void;
  onRemove: () => void;
  onMove?: (offset: number) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export const GroupRow = ({
  group,
  isEditing,
  onToggleEditing,
  onPatch,
  onRemove,
  onMove,
  canMoveUp = false,
  canMoveDown = false,
}: GroupRowProps) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isPickingColor, setIsPickingColor] = useState(false);
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
  const [draftFilters, setDraftFilters] = useState<GroupFilters | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName) nameInputRef.current?.focus();
  }, [isEditingName]);

  // Seeded from the group only as editing opens: re-seeding on every filter change would throw
  // away the edit in progress, which is the thing Cancel exists to hand back.
  useEffect(() => {
    setDraftFilters(isEditing ? group.filters : null);
  }, [isEditing]);

  const filters = draftFilters ?? group.filters;

  const save = () => {
    onPatch({ filters });
    onToggleEditing?.();
  };

  const cancel = () => {
    setDraftFilters(null);
    onToggleEditing?.();
  };

  return (
    <div className={`group-row${isEditing ? ' is-open' : ''}`}>
      {onMove && (
        <div className="group-order">
          <button
            type="button"
            className="group-order-button"
            title="Move up"
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
          >
            <ArrowUpIcon size={14} />
          </button>
          <button
            type="button"
            className="group-order-button"
            title="Move down"
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
          >
            <ArrowDownIcon size={14} />
          </button>
        </div>
      )}

      <div className="group-body">
        <div className="group-head">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              className="text-input"
              value={group.name}
              aria-label="Group name"
              onChange={(event) => onPatch({ name: event.target.value })}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== 'Escape') return;
                // Both keys are the modal's too, and finishing a rename is not closing the editor.
                event.stopPropagation();
                setIsEditingName(false);
              }}
            />
          ) : (
            <div className="group-title-row">
              <span className="group-title">{group.name}</span>
              <button
                type="button"
                className="icon-button is-tiny-square group-title-edit"
                title="Rename group"
                onClick={() => setIsEditingName(true)}
              >
                <PencilIcon />
              </button>
            </div>
          )}

          {isConfirmingRemove ? (
            <div className="group-remove-confirm">
              <span className="hint">Delete this group?</span>
              <button type="button" className="link-button is-danger" onClick={onRemove}>
                Delete
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => setIsConfirmingRemove(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="group-head-actions">
              {isPickingColor ? (
                <HuePicker
                  hue={group.hue}
                  onChange={(hue) => onPatch({ hue })}
                  onDone={() => setIsPickingColor(false)}
                />
              ) : (
                <button
                  type="button"
                  className={`color-dot${group.hue === null ? ' is-none' : ' is-tinted'}`}
                  style={hueStyle(group.hue)}
                  title={group.hue === null ? 'Default color' : `Color, hue ${group.hue}`}
                  aria-label="Group color"
                  onClick={() => setIsPickingColor(true)}
                />
              )}

              <button
                type="button"
                className={`icon-button is-tiny-square${group.notifyOnNew ? ' is-active' : ''}`}
                title={
                  group.notifyOnNew
                    ? 'Notifying when a pull request lands here'
                    : 'Not notifying. Click to turn notifications on.'
                }
                aria-pressed={group.notifyOnNew}
                onClick={() => onPatch({ notifyOnNew: !group.notifyOnNew })}
              >
                {group.notifyOnNew ? <BellIcon size={13} /> : <BellOffIcon size={13} />}
              </button>

              <button
                type="button"
                className="icon-button is-tiny-square is-danger"
                title={`Remove ${group.name}`}
                onClick={() => setIsConfirmingRemove(true)}
              >
                <TrashIcon size={13} />
              </button>
            </div>
          )}
        </div>

        <p className="group-describe">{describeFilters(filters)}</p>

        {isEditing && (
          <div className="filter-picker">
            {COLUMNS.map((column) => (
              <ColumnFilter
                key={column.id}
                column={column}
                selected={filters[column.id] ?? []}
                onChange={(selected) =>
                  setDraftFilters({ ...filters, [column.id]: selected })
                }
              />
            ))}
          </div>
        )}

        <div className="group-actions">
          {isEditing ? (
            <>
              <button type="button" className="group-button is-primary" onClick={save}>
                Save
              </button>
              <button type="button" className="group-button" onClick={cancel}>
                Cancel
              </button>
            </>
          ) : (
            onToggleEditing && (
              <button type="button" className="group-button" onClick={onToggleEditing}>
                Edit
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
