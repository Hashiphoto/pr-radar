import { useEffect } from 'react';
import { COLUMNS } from '../../shared/columns.js';
import { CloseIcon } from './Icons.js';

export interface HelpModalProps {
  onClose: () => void;
}

export const HelpModal = ({ onClose }: HelpModalProps) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="modal-scrim" onClick={onClose} />
      <div className="modal is-wide" role="dialog" aria-modal="true" aria-label="What the columns mean">
        <div className="modal-head">
          <h2>What the columns mean</h2>
          <div className="topbar-spacer" />
          <button type="button" className="icon-button" onClick={onClose} title="Close (Esc)">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          <p className="hint">
            A group narrows any column to the values you pick. Several values in one column match a
            row owning <strong>any</strong> of them, and different columns must <strong>all</strong>
            {' '}match. A column left at <em>All</em> is ignored. Every value a row shows is a value
            you can filter on, and nothing filters on anything a row does not show.
          </p>

          {COLUMNS.map((column) => (
            <div className="help-column" key={column.id}>
              <span className="field-label">{column.label}</span>
              {column.note && <p className="hint is-tight">{column.note}</p>}
              <dl className="help-values">
                {column.values.map((value) => (
                  <div className="help-value" key={value.id}>
                    <dt>
                      <span className={`pill is-${value.tone}`}>{value.label}</span>
                    </dt>
                    <dd>{value.rule}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}

          <div className="help-column">
            <span className="field-label">Elsewhere in a row</span>
            <p className="hint is-tight">
              The status icon carries a red warning when the branch conflicts with its base. The age
              beside the branch is how long the pull request has been open, amber past two days and
              red past seven. Hover <code>#number</code> for the diff size. Drag a column edge to
              resize it, double click to reset.
            </p>
          </div>
        </div>

        <div className="modal-foot">
          <span className="hint">
            <kbd>?</kbd> reopens this · <kbd>,</kbd> settings · <kbd>g</kbd> groups
          </span>
          <button type="button" className="primary-button" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </>
  );
};
