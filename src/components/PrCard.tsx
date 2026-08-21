import { useState } from 'react';
import { jiraKeyFromTitle, jiraUrl } from '../../shared/jira.js';
import type { PullRequest, ReviewState } from '../../shared/types.js';
import { compactNumber, relativeAge, staleness } from '../format.js';
import { ChecksPanel } from './ChecksPanel.js';
import { BranchIcon, CheckIcon, CopyIcon, MuteIcon, StarIcon, UndoIcon } from './Icons.js';

type BadgeTone = 'neutral' | 'green' | 'red' | 'amber' | 'purple' | 'accent' | 'gold';

interface Badge {
  key: string;
  label: string;
  tone: BadgeTone;
  title?: string;
}

const hasFailingChecks = (pullRequest: PullRequest): boolean =>
  pullRequest.checkState === 'FAILURE' || pullRequest.checkState === 'ERROR';

const checkBadge = (pullRequest: PullRequest): Badge | null => {
  switch (pullRequest.checkState) {
    case 'SUCCESS':
      return { key: 'checks', label: 'checks pass', tone: 'green' };
    case 'FAILURE':
    case 'ERROR':
      return { key: 'checks', label: 'checks failed', tone: 'red' };
    case 'PENDING':
    case 'EXPECTED':
      return { key: 'checks', label: 'checks running', tone: 'amber' };
    default:
      return null;
  }
};

// One badge per side, so the card says the most blocking thing the review state contains rather
// than every tag the group filters on.
const reviewBadge = (side: 'humans' | 'bots', state: ReviewState): Badge => {
  const badge = ((): { label: string; tone: BadgeTone } => {
    if (state.hasUnresolvedThreads) return { label: 'unresolved threads', tone: 'purple' };
    if (state.isApproved) return { label: 'approved', tone: 'green' };
    if (state.stage === 'reviewed') return { label: 'reviewed', tone: 'accent' };
    if (state.stage === 'awaiting') return { label: 'awaiting review', tone: 'amber' };
    return { label: 'not requested', tone: 'neutral' };
  })();

  return { key: side, label: `${side}: ${badge.label}`, tone: badge.tone };
};

const approvalBadge = (pullRequest: PullRequest): Badge | null => {
  if (pullRequest.reviewDecision === 'APPROVED') {
    return {
      key: 'review',
      label: pullRequest.approvalCount > 1 ? `approved ×${pullRequest.approvalCount}` : 'approved',
      tone: 'green',
    };
  }
  if (pullRequest.reviewDecision === 'CHANGES_REQUESTED') {
    return { key: 'review', label: 'changes requested', tone: 'red' };
  }
  if (pullRequest.approvalCount > 0) {
    return { key: 'review', label: `${pullRequest.approvalCount} approval`, tone: 'green' };
  }
  return null;
};

const buildBadges = (pullRequest: PullRequest, showRequestSource: boolean): Badge[] => {
  const badges: Badge[] = [];

  if (pullRequest.isDraft) badges.push({ key: 'draft', label: 'draft', tone: 'neutral' });

  const approval = approvalBadge(pullRequest);
  if (approval) badges.push(approval);

  badges.push(reviewBadge('humans', pullRequest.humanReview));
  badges.push(reviewBadge('bots', pullRequest.botReview));

  const checks = checkBadge(pullRequest);
  if (checks) badges.push(checks);

  if (pullRequest.mergeable === 'CONFLICTING') {
    badges.push({ key: 'conflict', label: 'conflicts', tone: 'red' });
  }

  if (pullRequest.unresolvedThreadCount > 0) {
    badges.push({
      key: 'threads',
      label: `${pullRequest.unresolvedThreadCount} unresolved thread${pullRequest.unresolvedThreadCount === 1 ? '' : 's'}`,
      tone: 'purple',
    });
  }

  if (showRequestSource) {
    if (pullRequest.requestedFromMeDirectly) {
      badges.push({ key: 'direct', label: 'you', tone: 'accent', title: 'Requested from you directly' });
    }
    for (const team of pullRequest.requestedTeams) {
      badges.push({ key: `team-${team}`, label: team, tone: 'neutral', title: `Requested from team ${team}` });
    }
    if (pullRequest.myReviewState === 'COMMENTED') {
      badges.push({ key: 'mine', label: 'you commented', tone: 'amber' });
    }
  }

  return badges;
};

export interface PrCardProps {
  pullRequest: PullRequest;
  showRequestSource: boolean;
  isVipAuthor: boolean;
  jiraBaseUrl: string;
  onToggleVip?: (login: string) => void;
  onDismiss?: (pullRequest: PullRequest) => void;
  onRestore?: (pullRequest: PullRequest) => void;
}

export const PrCard = ({
  pullRequest,
  showRequestSource,
  isVipAuthor,
  jiraBaseUrl,
  onToggleVip,
  onDismiss,
  onRestore,
}: PrCardProps) => {
  const [isChecksOpen, setIsChecksOpen] = useState(false);
  const [isBranchCopied, setIsBranchCopied] = useState(false);
  const badges = buildBadges(pullRequest, showRequestSource);
  const authorLogin = pullRequest.author?.login;
  const age = staleness(pullRequest.createdAt);
  const isChecksExpandable = hasFailingChecks(pullRequest);
  const jiraKey = jiraBaseUrl ? jiraKeyFromTitle(pullRequest.title) : null;

  const copyBranch = async () => {
    try {
      await navigator.clipboard.writeText(pullRequest.headRefName);
      setIsBranchCopied(true);
      window.setTimeout(() => setIsBranchCopied(false), 1400);
    } catch {
      /* clipboard blocked: leave the label alone rather than claim a copy that did not happen */
    }
  };

  return (
    <div className={`card-shell${isChecksOpen ? ' is-expanded' : ''}`}>
    <article className={`card${isVipAuthor ? ' is-vip' : ''}${onRestore ? ' is-dimmed' : ''}`}>
      {pullRequest.author && (
        <img className="avatar" src={pullRequest.author.avatarUrl} alt="" loading="lazy" />
      )}

      <div className="card-body">
        <a className="card-title" href={pullRequest.url} target="_blank" rel="noreferrer">
          {pullRequest.title}
        </a>

        <div className="card-sub">
          <span>{pullRequest.repository}</span>
          <span className="sep">#{pullRequest.number}</span>
          {jiraKey && (
            <>
              <span className="sep">·</span>
              <a
                className="jira-link"
                href={jiraUrl(jiraBaseUrl, jiraKey)}
                target="_blank"
                rel="noreferrer"
                title={`Open ${jiraKey} in Jira`}
              >
                {jiraKey}
              </a>
            </>
          )}
          {authorLogin && (
            <>
              <span className="sep">·</span>
              <span className="author">{authorLogin}</span>
            </>
          )}
          <span className="sep">·</span>
          <span title={new Date(pullRequest.createdAt).toLocaleString()}>
            opened {relativeAge(pullRequest.createdAt)} ago
          </span>
          <span className="sep">·</span>
          <span title={new Date(pullRequest.updatedAt).toLocaleString()}>
            active {relativeAge(pullRequest.updatedAt)} ago
          </span>
          <span className="sep">·</span>
          <span>
            <span className="diff-add">+{compactNumber(pullRequest.additions)}</span>{' '}
            <span className="diff-del">−{compactNumber(pullRequest.deletions)}</span>{' '}
            <span>in {pullRequest.changedFiles} file{pullRequest.changedFiles === 1 ? '' : 's'}</span>
          </span>
        </div>

        <div className="card-sub">
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
        </div>

        <div className="badges">
          {age !== 'fresh' && showRequestSource && (
            <span className={`badge is-${age === 'stale' ? 'red' : 'amber'}`}>
              waiting {relativeAge(pullRequest.createdAt)}
            </span>
          )}
          {badges.map((badge) =>
            badge.key === 'checks' && isChecksExpandable ? (
              <button
                type="button"
                key={badge.key}
                className={`badge is-${badge.tone} is-clickable${isChecksOpen ? ' is-open' : ''}`}
                title="Show why the checks failed"
                onClick={() => setIsChecksOpen((current) => !current)}
              >
                {badge.label}
                <span className="badge-caret">{isChecksOpen ? '▾' : '▸'}</span>
              </button>
            ) : (
              <span key={badge.key} className={`badge is-${badge.tone}`} title={badge.title}>
                {badge.label}
              </span>
            ),
          )}
        </div>
      </div>

      <div className="card-actions">
        {authorLogin && onToggleVip && (
          <button
            type="button"
            className={`ghost-button${isVipAuthor ? ' is-on' : ''}`}
            title={isVipAuthor ? `Remove ${authorLogin} from VIPs` : `Add ${authorLogin} to VIPs`}
            onClick={() => onToggleVip(authorLogin)}
          >
            <StarIcon filled={isVipAuthor} />
          </button>
        )}
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
    </article>
    {isChecksOpen && <ChecksPanel repository={pullRequest.repository} number={pullRequest.number} />}
    </div>
  );
};
