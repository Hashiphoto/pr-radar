import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { PullRequest } from '../../shared/types.js';
import type { PrEntry } from '../entries.js';
import { PrRow } from './PrRow.js';

interface ColumnLayout {
  id: string;
  label: string;
  hiddenLabel?: string;
  minWidth: number;
}

export const DEFAULT_WIDTHS: Record<string, number> = {
  status: 46,
  repo: 128,
  jira: 100,
  author: 158,
  checks: 104,
  human: 148,
  bot: 148,
  actions: 46,
};

// The name column is the only one without a width, so it absorbs whatever the others leave and
// dragging one edge moves that column alone rather than everything to its right.
const LAYOUT: ColumnLayout[] = [
  { id: 'status', label: '', hiddenLabel: 'Status', minWidth: 40 },
  { id: 'name', label: 'Pull request', minWidth: 0 },
  { id: 'repo', label: 'Repo', minWidth: 60 },
  { id: 'jira', label: 'Jira', minWidth: 56 },
  { id: 'author', label: 'Author', minWidth: 70 },
  { id: 'checks', label: 'Checks', minWidth: 68 },
  { id: 'human', label: 'Human review', minWidth: 80 },
  { id: 'bot', label: 'Bot review', minWidth: 80 },
  { id: 'actions', label: '', hiddenLabel: 'Actions', minWidth: 34 },
];

export interface PrTableProps {
  entries: PrEntry[];
  reviewRequestIds: Set<string>;
  dismissedIds: Set<string>;
  jiraBaseUrl: string;
  botReviewComment: string;
  widths: Record<string, number>;
  onResize: (column: string, width: number) => void;
  onToggleVip: (login: string) => void;
  onDismiss: (pullRequest: PullRequest) => void;
  onRestore: (pullRequest: PullRequest) => void;
}

export const PrTable = ({
  entries,
  reviewRequestIds,
  dismissedIds,
  jiraBaseUrl,
  botReviewComment,
  widths,
  onResize,
  onToggleVip,
  onDismiss,
  onRestore,
}: PrTableProps) => {
  const dragRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null);

  const widthOf = (column: ColumnLayout): number =>
    widths[column.id] ?? DEFAULT_WIDTHS[column.id] ?? 0;

  const startResize = (column: ColumnLayout) => (event: ReactPointerEvent) => {
    event.preventDefault();
    dragRef.current = { column: column.id, startX: event.clientX, startWidth: widthOf(column) };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const trackResize = (column: ColumnLayout) => (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.column !== column.id) return;
    onResize(column.id, Math.max(column.minWidth, drag.startWidth + event.clientX - drag.startX));
  };

  return (
    <div className="pr-table-scroll">
      <table className="pr-table">
        <colgroup>
          {LAYOUT.map((column) => (
            <col
              key={column.id}
              className={`col-${column.id}`}
              {...(column.id === 'name' ? {} : { style: { width: widthOf(column) } })}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            {LAYOUT.map((column) => (
              <th key={column.id} scope="col">
                {column.label}
                {column.hiddenLabel && <span className="sr-only">{column.hiddenLabel}</span>}
                {column.id !== 'actions' && (
                  <span
                    className="col-resize"
                    title={`Drag to resize ${column.label || 'this column'}, double click to reset`}
                    onPointerDown={startResize(column)}
                    onPointerMove={trackResize(column)}
                    onPointerUp={() => {
                      dragRef.current = null;
                    }}
                    onDoubleClick={() => onResize(column.id, DEFAULT_WIDTHS[column.id] ?? 0)}
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isReviewRequest = reviewRequestIds.has(entry.pullRequest.id);
            const isDismissed = dismissedIds.has(entry.pullRequest.id);

            return (
              <PrRow
                key={entry.pullRequest.id}
                pullRequest={entry.pullRequest}
                values={entry.values}
                showRequestSource={isReviewRequest}
                jiraBaseUrl={jiraBaseUrl}
                botReviewComment={botReviewComment}
                {...(isReviewRequest ? { onToggleVip } : {})}
                {...(isReviewRequest && !isDismissed ? { onDismiss } : {})}
                {...(isDismissed ? { onRestore } : {})}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
