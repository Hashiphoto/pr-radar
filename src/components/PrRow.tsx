import { useEffect, useState } from 'react';
import { columnValue, openThreadCount, type ColumnId, type ColumnValues } from '../../shared/columns.js';
import { jiraKeyFromTitle, jiraUrl } from '../../shared/jira.js';
import type { PrState, PullRequest } from '../../shared/types.js';
import * as api from '../api.js';
import { compactNumber, relativeAge, staleness } from '../format.js';
import { ChecksPanel } from './ChecksPanel.js';
import {
  BranchIcon,
  CheckIcon,
  ConflictIcon,
  CopyIcon,
  MuteIcon,
  PrDraftIcon,
  PrOpenIcon,
  StarIcon,
  UndoIcon,
} from './Icons.js';

export const COLUMN_COUNT = 10;

const StateIcon = ({ state }: { state: PrState }) =>
  state === 'draft' ? <PrDraftIcon /> : <PrOpenIcon />;

const statusTitle = (status: string): string => {
  const value = columnValue('status', status);
  return value ? `${value.label} — ${value.rule}` : status;
};

const shortRepo = (repository: string): string => repository.split('/').pop() ?? repository;

interface ValuePillProps {
  column: ColumnId;
  values: ColumnValues;
  count?: number;
}

const ValuePill = ({ column, values, count = 0 }: ValuePillProps) => {
  const value = columnValue(column, values[column]);
  if (!value) return <span className="cell-empty">—</span>;

  return (
    <span className={`pill is-${value.tone}`} title={`${value.label} — ${value.rule}`}>
      {value.label}
      {count > 1 && <span className="pill-detail">×{count}</span>}
    </span>
  );
};

// Long enough that a second click lands after the comment is on the pull request, short enough
// that a bot which never showed up can be nudged again without a reload.
const requestCooldownMs = 60_000;

type RequestState = 'idle' | 'sending' | 'sent';

export interface PrRowProps {
  pullRequest: PullRequest;
  values: ColumnValues;
  showRequestSource: boolean;
  jiraBaseUrl: string;
  botReviewComment: string;
  onToggleVip?: (login: string) => void;
  onDismiss?: (pullRequest: PullRequest) => void;
  onRestore?: (pullRequest: PullRequest) => void;
}

export const PrRow = ({
  pullRequest,
  values,
  showRequestSource,
  jiraBaseUrl,
  botReviewComment,
  onToggleVip,
  onDismiss,
  onRestore,
}: PrRowProps) => {
  const [isChecksOpen, setIsChecksOpen] = useState(false);
  const [isBranchCopied, setIsBranchCopied] = useState(false);
  const [requestState, setRequestState] = useState<RequestState>('idle');
  const [requestError, setRequestError] = useState<string | null>(null);
  const authorLogin = pullRequest.author?.login;
  const isVipAuthor = values.author === 'vip';
  const age = staleness(pullRequest.createdAt);
  const jiraKey = jiraBaseUrl ? jiraKeyFromTitle(pullRequest.title) : null;
  const isChecksExpandable = values.checks === 'failing';
  const humanCount =
    values.human === 'approved' ? pullRequest.approvalCount : pullRequest.changesRequestedCount;

  const copyBranch = async () => {
    try {
      await navigator.clipboard.writeText(pullRequest.headRefName);
      setIsBranchCopied(true);
      window.setTimeout(() => setIsBranchCopied(false), 1400);
    } catch {
      /* clipboard blocked: leave the label alone rather than claim a copy that did not happen */
    }
  };

  useEffect(() => {
    if (requestState !== 'sent') return;
    const timer = window.setTimeout(() => setRequestState('idle'), requestCooldownMs);
    return () => window.clearTimeout(timer);
  }, [requestState]);

  const askForBotReview = async () => {
    setRequestState('sending');
    setRequestError(null);
    try {
      await api.requestBotReview(pullRequest.repository, pullRequest.number);
      setRequestState('sent');
    } catch (caught) {
      setRequestError(caught instanceof Error ? caught.message : 'Could not post the comment');
      setRequestState('idle');
    }
  };

  // Only on a draft: asking a bot early is the point, and once the pull request is ready its
  // reviewers are already on the hook.
  const canAskForBotReview =
    botReviewComment.length > 0 &&
    pullRequest.state === 'draft' &&
    values.bot === 'notRequested';

  const requestNote = [
    pullRequest.requestedFromMeDirectly ? 'requested from you' : '',
    ...pullRequest.requestedTeams.map((team) => `via ${team}`),
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <tr
        className={`pr-row${isVipAuthor ? ' is-vip' : ''}${onRestore ? ' is-dimmed' : ''}${
          isChecksOpen ? ' is-expanded' : ''
        }`}
      >
        <td className="cell-status">
          <div className="status-stack">
            <span className={`state-icon is-${pullRequest.state}`} title={statusTitle(values.status)}>
              <StateIcon state={pullRequest.state} />
            </span>
            {pullRequest.mergeable === 'CONFLICTING' && (
              <span className="state-icon is-conflict" title="Conflicts with the base branch">
                <ConflictIcon />
              </span>
            )}
          </div>
        </td>

        <td className="cell-name">
          <div className="name-line">
            <a href={pullRequest.url} target="_blank" rel="noreferrer" title={pullRequest.title}>
              {pullRequest.title}
            </a>
            <span
              className="pr-number"
              title={`+${compactNumber(pullRequest.additions)} −${compactNumber(pullRequest.deletions)} in ${pullRequest.changedFiles} file${pullRequest.changedFiles === 1 ? '' : 's'}`}
            >
              #{pullRequest.number}
            </span>
          </div>
          <div className="name-line is-sub">
            <button
              type="button"
              className={`branch-chip${isBranchCopied ? ' is-copied' : ''}`}
              title={`Copy ${pullRequest.headRefName}`}
              onClick={() => void copyBranch()}
            >
              <BranchIcon />
              <span className="branch-name">{pullRequest.headRefName}</span>
              <span className="branch-hint">{isBranchCopied ? <CheckIcon /> : <CopyIcon />}</span>
            </button>
            <span
              className={`age is-${age}`}
              title={`Opened ${new Date(pullRequest.createdAt).toLocaleString()}, last active ${relativeAge(pullRequest.updatedAt)} ago`}
            >
              {relativeAge(pullRequest.createdAt)}
            </span>
            {showRequestSource && requestNote && <span className="request-note">{requestNote}</span>}
          </div>
        </td>

        <td className="cell-repo">
          <span title={pullRequest.repository}>{shortRepo(pullRequest.repository)}</span>
        </td>

        <td className="cell-jira">
          {jiraKey ? (
            <a
              className="jira-link"
              href={jiraUrl(jiraBaseUrl, jiraKey)}
              target="_blank"
              rel="noreferrer"
              title={`Open ${jiraKey} in Jira`}
            >
              {jiraKey}
            </a>
          ) : (
            <span className="cell-empty">—</span>
          )}
        </td>

        <td className="cell-author">
          {authorLogin ? (
            <div className="author-chip">
              <img src={pullRequest.author?.avatarUrl} alt="" loading="lazy" title={authorLogin} />
              <span className="author-name" title={authorLogin}>
                {authorLogin}
              </span>
              {onToggleVip && (
                <button
                  type="button"
                  className={`author-star${isVipAuthor ? ' is-on' : ''}`}
                  title={isVipAuthor ? `Remove ${authorLogin} from VIPs` : `Add ${authorLogin} to VIPs`}
                  onClick={() => onToggleVip(authorLogin)}
                >
                  <StarIcon size={14} filled={isVipAuthor} />
                </button>
              )}
            </div>
          ) : (
            <span className="cell-empty">—</span>
          )}
        </td>

        <td className="cell-checks">
          {isChecksExpandable ? (
            <button
              type="button"
              className={`pill is-red is-clickable${isChecksOpen ? ' is-open' : ''}`}
              title="Show why the checks failed"
              onClick={() => setIsChecksOpen((current) => !current)}
            >
              Failing
              <span className="pill-caret">{isChecksOpen ? '▾' : '▸'}</span>
            </button>
          ) : (
            <ValuePill column="checks" values={values} />
          )}
        </td>

        <td className="cell-review">
          <ValuePill column="human" values={values} count={humanCount} />
        </td>

        <td className="cell-review">
          {canAskForBotReview ? (
            <button
              type="button"
              className={`pill is-clickable is-ask${requestError ? ' is-red' : ' is-neutral'}`}
              disabled={requestState !== 'idle'}
              title={requestError ?? `Comment "${botReviewComment}" on this pull request`}
              onClick={() => void askForBotReview()}
            >
              {requestState === 'idle' ? (
                <>
                  <span className="ask-resting">Not requested</span>
                  <span className="ask-hover">Ask</span>
                </>
              ) : (
                'Asked'
              )}
            </button>
          ) : (
            <ValuePill column="bot" values={values} />
          )}
        </td>

        <td className="cell-review">
          <ValuePill column="feedback" values={values} count={openThreadCount(pullRequest)} />
        </td>

        <td className="cell-actions">
          <div className="row-actions">
            {onDismiss && (
              <button
                type="button"
                className="ghost-button is-danger"
                title="Not going to review"
                onClick={() => onDismiss(pullRequest)}
              >
                <MuteIcon />
              </button>
            )}
            {onRestore && (
              <button
                type="button"
                className="ghost-button"
                title="Move back into the review queue"
                onClick={() => onRestore(pullRequest)}
              >
                <UndoIcon />
              </button>
            )}
          </div>
        </td>
      </tr>

      {isChecksOpen && (
        <tr className="checks-row">
          <td colSpan={COLUMN_COUNT}>
            <ChecksPanel repository={pullRequest.repository} number={pullRequest.number} />
          </td>
        </tr>
      )}
    </>
  );
};
