import { useEffect, useState } from 'react';
import type { Group } from '../../shared/types.js';
import { GroupEditor } from './GroupEditor.js';
import { CloseIcon } from './Icons.js';

export interface GroupEditorModalProps {
  groups: Group[];
  onSave: (groups: Group[]) => void;
  onClose: () => void;
}

export const GroupEditorModal = ({ groups, onSave, onClose }: GroupEditorModalProps) => {
  const [draft, setDraft] = useState(groups);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(groups);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const save = () => {
    onSave(draft);
    onClose();
  };

  return (
    <>
      <div className="modal-scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label="Groups">
        <div className="modal-head">
          <h2>Groups</h2>
          <div className="topbar-spacer" />
          <button type="button" className="icon-button" onClick={onClose} title="Close (Esc)">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          <p className="hint">
            Every group is a section on the dashboard, in this order. A pull request shows up in
            each group it matches. Nothing is saved until you save.
          </p>
          <GroupEditor groups={draft} onChange={setDraft} />
        </div>

        <div className="modal-foot">
          <span className="hint">{isDirty ? 'Unsaved changes' : 'No changes'}</span>
          <button type="button" className="icon-button" onClick={onClose}>
            {isDirty ? 'Discard' : 'Close'}
          </button>
          <button type="button" className="primary-button" onClick={save} disabled={!isDirty}>
            Save groups
          </button>
        </div>
      </div>
    </>
  );
};
