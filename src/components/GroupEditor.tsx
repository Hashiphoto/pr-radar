import { useState } from 'react';
import type { Group } from '../../shared/types.js';
import { moveGroup, nextGroupId } from '../groups.js';
import { GroupRow } from './GroupRow.js';
import { PlusIcon } from './Icons.js';

export interface GroupEditorProps {
  groups: Group[];
  onChange: (groups: Group[]) => void;
}

export const GroupEditor = ({ groups, onChange }: GroupEditorProps) => {
  const [openId, setOpenId] = useState<string | null>(null);

  const add = () => {
    const id = nextGroupId(groups);
    onChange([...groups, { id, name: 'New group', scope: 'all', tags: [], notifyOnNew: false }]);
    setOpenId(id);
  };

  return (
    <div className="groups">
      {groups.map((group, index) => (
        <GroupRow
          key={group.id}
          group={group}
          isPickerOpen={openId === group.id}
          onTogglePicker={() => setOpenId((current) => (current === group.id ? null : group.id))}
          onPatch={(changes) =>
            onChange(groups.map((entry) => (entry.id === group.id ? { ...entry, ...changes } : entry)))
          }
          onRemove={() => onChange(groups.filter((entry) => entry.id !== group.id))}
          onMove={(offset) => onChange(moveGroup(groups, index, index + offset))}
          canMoveUp={index > 0}
          canMoveDown={index < groups.length - 1}
        />
      ))}

      <button type="button" className="primary-button is-wide" onClick={add}>
        <PlusIcon /> Add group
      </button>
    </div>
  );
};
