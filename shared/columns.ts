import type { PullRequest, ReviewState } from './types.js';

export type Tone = 'neutral' | 'green' | 'red' | 'amber' | 'purple' | 'accent' | 'gold';

export type ColumnId = 'status' | 'author' | 'checks' | 'human' | 'bot' | 'feedback';

export interface ColumnValue {
  id: string;
  label: string;
  tone: Tone;
  // Stated here rather than in the help window, so the rule and the code deciding it move together.
  rule: string;
}

export interface ColumnDefinition {
  id: ColumnId;
  label: string;
  values: ColumnValue[];
  note?: string;
}

// A column left out entirely means "All", so a group only ever names the values it narrows to.
export type GroupFilters = Partial<Record<ColumnId, string[]>>;

// Every column answers one question, and exactly one of its values is true of any pull request.
// That is what lets a set of groups be checked: each group is a box in this grid, and the boxes
// either tile it or they do not.
// Stated once for both sides, because a re-request means the same thing whoever was asked.
const reRequestNote =
  'A re-requested review supersedes what that reviewer said before: their earlier pass stops counting as landed, so the column reads Requested again.';

export const COLUMNS: ColumnDefinition[] = [
  {
    id: 'status',
    label: 'Status',
    values: [
      { id: 'draft', label: 'Draft', tone: 'neutral', rule: 'Open and marked as a draft.' },
      { id: 'ready', label: 'Ready', tone: 'green', rule: 'Open and out of draft.' },
    ],
    note: 'Merged and closed pull requests are never fetched, so every row is live work.',
  },
  {
    id: 'author',
    label: 'Author',
    values: [
      {
        id: 'you',
        label: 'You',
        tone: 'accent',
        rule: 'You created the pull request.',
      },
      {
        id: 'vip',
        label: 'VIP',
        tone: 'gold',
        rule: 'The author is on your VIP list. Star anyone in the Author column to add them.',
      },
      {
        id: 'other',
        label: 'Everyone else',
        tone: 'neutral',
        rule: 'The author is not you and not on your VIP list.',
      },
    ],
  },
  {
    id: 'human',
    label: 'Human review',
    values: [
      {
        id: 'notRequested',
        label: 'Not requested',
        tone: 'neutral',
        rule: 'No human review requested or completed.',
      },
      {
        id: 'requested',
        label: 'Requested',
        tone: 'amber',
        rule: 'One or more reviews requested, none completed.',
      },
      {
        id: 'changesRequested',
        label: 'Changes requested',
        tone: 'red',
        rule: 'At least one completed review requested changes.',
      },
      {
        id: 'approved',
        label: 'Approved',
        tone: 'green',
        rule: 'At least one reviewer approved and nobody requested changes. The count is how many approved.',
      },
      {
        id: 'commented',
        label: 'Commented',
        tone: 'accent',
        rule: 'At least one review completed, with no approvals and no changes requested.',
      },
    ],
    note: `Reviews by teams and non-bot users, never the author: answering a bot on your own pull request is recorded as a review, and counting it would say a human had looked when none had. ${reRequestNote} Whether comments are still open is the Feedback column.`,
  },
  {
    id: 'bot',
    label: 'Bot review',
    values: [
      {
        id: 'notRequested',
        label: 'Not requested',
        tone: 'neutral',
        rule: 'No bot review requested or completed. On a draft, this cell is a button that asks the bot named in settings.',
      },
      {
        id: 'requested',
        label: 'Requested',
        tone: 'amber',
        rule: 'A bot review is requested and none has completed since.',
      },
      {
        id: 'completed',
        label: 'Completed',
        tone: 'purple',
        rule: 'At least one bot has finished reviewing. Whether it left anything open is the Feedback column.',
      },
    ],
    note: `Reviews by bot users, never teams, so a CodeRabbit nit never reads as a human blocking you. Which accounts count as bots is set under Bot accounts in settings. ${reRequestNote}`,
  },
  {
    id: 'feedback',
    label: 'Feedback',
    values: [
      {
        id: 'unresolved',
        label: 'Unresolved',
        tone: 'purple',
        rule: 'At least one review thread is unresolved. The count is how many.',
      },
      {
        id: 'clear',
        label: 'None',
        tone: 'neutral',
        rule: 'Every review thread is resolved, or there never was one.',
      },
    ],
    note: 'Open threads from humans and bots alike, since a thread is work to do either way. Threads the author started do not count: a question you asked on your own pull request is not feedback you owe.',
  },
  {
    id: 'checks',
    label: 'Checks',
    values: [
      {
        id: 'passing',
        label: 'Passing',
        tone: 'green',
        rule: "GitHub's check rollup for the newest commit succeeded.",
      },
      {
        id: 'failing',
        label: 'Failing',
        tone: 'red',
        rule: 'The rollup failed or errored. Click the pill to read the failing tests out of the Azure Pipelines logs and retry a stage.',
      },
      { id: 'running', label: 'Running', tone: 'amber', rule: 'The rollup is pending or expected.' },
      { id: 'none', label: 'None', tone: 'neutral', rule: 'No checks reported for the newest commit.' },
    ],
  },
];

// One value per column, so a row and a group filter ask the same question of the same shape.
export type ColumnValues = Record<ColumnId, string>;

const valueIndex = new Map(
  COLUMNS.map((column) => [column.id, new Map(column.values.map((value) => [value.id, value]))]),
);

export const columnValue = (column: ColumnId, id: string): ColumnValue | null =>
  valueIndex.get(column)?.get(id) ?? null;

export interface AuthorIdentity {
  isMine: boolean;
  isVip: boolean;
}

// One author per row, viewer first: a pull request of mine is mine even if I put myself on my own
// VIP list, which keeps the three values a partition rather than an overlapping pair.
const authorValue = (author: AuthorIdentity): string => {
  if (author.isMine) return 'you';
  return author.isVip ? 'vip' : 'other';
};

// Changes requested outranks an approval because one reviewer asking for changes is the answer,
// and an approval outranks a bare comment for the same reason.
const humanValue = (state: ReviewState): string => {
  if (state.hasChangesRequested) return 'changesRequested';
  if (state.isApproved) return 'approved';
  if (state.hasBeenReviewed) return 'commented';
  return state.isRequested ? 'requested' : 'notRequested';
};

const botValue = (state: ReviewState): string => {
  if (state.hasBeenReviewed) return 'completed';
  return state.isRequested ? 'requested' : 'notRequested';
};

const checksValue = (checkState: PullRequest['checkState']): string => {
  switch (checkState) {
    case 'SUCCESS':
      return 'passing';
    case 'FAILURE':
    case 'ERROR':
      return 'failing';
    case 'PENDING':
    case 'EXPECTED':
      return 'running';
    default:
      return 'none';
  }
};

export const openThreadCount = (pullRequest: PullRequest): number =>
  pullRequest.humanReview.openThreadCount + pullRequest.botReview.openThreadCount;

export const columnValuesFor = (pullRequest: PullRequest, author: AuthorIdentity): ColumnValues => ({
  status: pullRequest.state,
  author: authorValue(author),
  human: humanValue(pullRequest.humanReview),
  bot: botValue(pullRequest.botReview),
  feedback: openThreadCount(pullRequest) > 0 ? 'unresolved' : 'clear',
  checks: checksValue(pullRequest.checkState),
});

export const matchesFilters = (values: ColumnValues, filters: GroupFilters): boolean =>
  COLUMNS.every((column) => {
    const selected = filters[column.id];
    if (!selected || selected.length === 0) return true;
    return selected.includes(values[column.id]);
  });

// Ids that older configs still name, expanded into the values that replaced them: a value that
// simply vanished would leave the group naming it wider than it was, or empty.
const REPLACED_VALUE_IDS: Partial<Record<ColumnId, Record<string, string[]>>> = {
  status: { merged: [] },
  human: { awaiting: ['requested'], reviewed: ['commented'], unresolved: [] },
  bot: {
    awaiting: ['requested'],
    reviewed: ['completed'],
    approved: ['completed'],
    changesRequested: ['completed'],
    unresolved: [],
  },
};

const expandReplaced = (column: ColumnId, selected: unknown[]): string[] =>
  selected.flatMap((value) =>
    typeof value === 'string' ? (REPLACED_VALUE_IDS[column]?.[value] ?? [value]) : [],
  );

// Selecting every value in a column is indistinguishable from selecting none, so it is stored as
// none: the editor and the summary then have one shape to read rather than two.
export const normalizeFilters = (raw: unknown): GroupFilters => {
  if (typeof raw !== 'object' || raw === null) return {};
  const source = raw as Record<string, unknown>;
  const filters: GroupFilters = {};

  for (const column of COLUMNS) {
    const selected = source[column.id];
    if (!Array.isArray(selected)) continue;
    const expanded = expandReplaced(column.id, selected);
    const kept = column.values.map((value) => value.id).filter((id) => expanded.includes(id));
    if (kept.length > 0 && kept.length < column.values.length) filters[column.id] = kept;
  }

  return filters;
};

export const describeFilters = (filters: GroupFilters): string => {
  const parts = COLUMNS.flatMap((column) => {
    const selected = filters[column.id] ?? [];
    if (selected.length === 0) return [];
    const labels = column.values
      .filter((value) => selected.includes(value.id))
      .map((value) => value.label);
    return [`${column.label}: ${labels.join(' or ')}`];
  });

  return parts.length > 0 ? parts.join(', ') : 'every pull request';
};

// Groups used to name a source list — the pull requests awaiting my review, or the ones I wrote —
// which the Author column now says outright, so an old scope becomes that filter rather than being
// dropped and quietly widening the group to everything.
export const filtersFromScope = (filters: GroupFilters, scope: unknown): GroupFilters => {
  if (scope !== 'incoming' && scope !== 'mine') return filters;

  // Under a mine scope, VIP or not was a question about the viewer's own pull requests, so the old
  // selection has nothing left to say and the scope is the whole answer.
  const author = scope === 'mine' ? ['you'] : (filters.author ?? ['vip', 'other']);
  return normalizeFilters({ ...filters, author });
};

interface LegacyTag {
  column: ColumnId;
  values: string[];
}

const legacyReviewTags = (side: 'human' | 'bot'): Record<string, LegacyTag> => {
  const entry = (values: string[]): LegacyTag => ({ column: side, values });

  return {
    [`${side}NotRequested`]: entry(['notRequested']),
    [`${side}NotReviewed`]: entry(['notRequested']),
    [`${side}Awaiting`]: entry(['awaiting']),
    [`${side}Reviewed`]: entry(['reviewed']),
    [`${side}UnresolvedThreads`]: entry(['unresolved']),
    [`${side}OpenComments`]: entry(['unresolved']),
    [`${side}Approved`]: entry(['approved']),
  };
};

// Tags that said what a pull request is *not* have no equivalent here, so they are left out
// rather than approximated: the group comes back wider, which shows up, instead of narrower,
// which reads as an empty queue. Dropped: notApproved, {side}NoUnresolvedThreads, mergeability.
const LEGACY_TAGS: Record<string, LegacyTag> = {
  ready: { column: 'status', values: ['ready'] },
  draft: { column: 'status', values: ['draft'] },
  vipAuthor: { column: 'author', values: ['vip'] },
  otherAuthor: { column: 'author', values: ['other'] },
  approved: { column: 'human', values: ['approved'] },
  checksPassing: { column: 'checks', values: ['passing'] },
  checksFailing: { column: 'checks', values: ['failing'] },
  checksRunning: { column: 'checks', values: ['running'] },
  checksNone: { column: 'checks', values: ['none'] },
  ...legacyReviewTags('human'),
  ...legacyReviewTags('bot'),
};

export const filtersFromTags = (tags: unknown): GroupFilters => {
  if (!Array.isArray(tags)) return {};

  const perColumn = new Map<ColumnId, Set<string>>();
  for (const tag of tags) {
    const legacy = typeof tag === 'string' ? LEGACY_TAGS[tag] : undefined;
    if (!legacy) continue;
    const existing = perColumn.get(legacy.column) ?? new Set<string>();
    for (const value of legacy.values) existing.add(value);
    perColumn.set(legacy.column, existing);
  }

  return normalizeFilters(
    Object.fromEntries([...perColumn].map(([column, values]) => [column, [...values]])),
  );
};
