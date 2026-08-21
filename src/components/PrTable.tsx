import type { PullRequest } from '../../shared/types.js';
import type { PrEntry } from '../entries.js';
import { PrRow } from './PrRow.js';

export interface PrTableProps {
  entries: PrEntry[];
  reviewRequestIds: Set<string>;
  dismissedIds: Set<string>;
  jiraBaseUrl: string;
  botReviewComment: string;
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
  onToggleVip,
  onDismiss,
  onRestore,
}: PrTableProps) => (
  <div className="pr-table-scroll">
    <table className="pr-table">
      <colgroup>
        <col className="col-status" />
        <col className="col-name" />
        <col className="col-repo" />
        <col className="col-jira" />
        <col className="col-author" />
        <col className="col-checks" />
        <col className="col-review" />
        <col className="col-review" />
        <col className="col-actions" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">
            <span className="sr-only">Status</span>
          </th>
          <th scope="col">Pull request</th>
          <th scope="col">Repo</th>
          <th scope="col">Jira</th>
          <th scope="col">Author</th>
          <th scope="col">Checks</th>
          <th scope="col">Human review</th>
          <th scope="col">Bot review</th>
          <th scope="col">
            <span className="sr-only">Actions</span>
          </th>
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
