import { TAG_DIMENSIONS } from '../../shared/tags.js';
import type { Group, GroupScope } from '../../shared/types.js';
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

export const summarizeGroup = (group: Group): string => {
  if (group.tags.length === 0) return 'every pull request in scope';
  return TAG_DIMENSIONS.filter((dimension) => dimension.tags.some((tag) => group.tags.includes(tag.id)))
    .map((dimension) =>
      dimension.tags
        .filter((tag) => group.tags.includes(tag.id))
        .map((tag) => tag.label)
        .join(' or '),
    )
    .join(' + ');
};

export const GroupRow = ({
  group,
  isPickerOpen,
  onTogglePicker,
  onPatch,
  onRemove,
  onMove,
  canMoveUp = false,
  canMoveDown = false,
}: GroupRowProps) => {
  const toggleTag = (tagId: string) =>
    onPatch({
      tags: group.tags.includes(tagId)
        ? group.tags.filter((tag) => tag !== tagId)
        : [...group.tags, tagId],
    });

  return (
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
            {isPickerOpen ? 'Done' : `Tags (${group.tags.length})`}
          </button>
        )}
      </div>

      <p className="hint is-tight">{summarizeGroup(group)}</p>

      {isPickerOpen && (
        <div className="tag-picker">
          {TAG_DIMENSIONS.map((dimension) => (
            <div className="tag-dimension" key={dimension.id}>
              <span className="tag-dimension-label">{dimension.label}</span>
              <div className="chip-list">
                {dimension.tags.map((tag) => (
                  <button
                    type="button"
                    key={tag.id}
                    className={`tag-toggle${group.tags.includes(tag.id) ? ' is-on' : ''}`}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="hint">
            Picking nothing in a dimension ignores it. Several tags in one dimension match any of
            them; tags in different dimensions must all match.
          </p>
        </div>
      )}
    </div>
  );
};
