import type { PullRequest, ReviewState } from './types.js';

export type Tone = 'neutral' | 'green' | 'red' | 'amber' | 'purple' | 'accent' | 'gold';

export type ColumnId = 'status' | 'author' | 'checks' | 'human' | 'bot';

export interface ColumnValue {
  id: string;
  label: string;
  tone: Tone;
}

export interface ColumnDefinition {
  id: ColumnId;
  label: string;
  values: ColumnValue[];
}

// A column left out entirely means "All", so a group only ever names the values it narrows to.
export type GroupFilters = Partial<Record<ColumnId, string[]>>;

// Review values coexist on purpose — a pull request can be reviewed, have changes requested and
// still owe another review — so a row carries every one it owns. Declaration order is display
// order, most blocking first, so the first pill in the cell is the one to act on.
const REVIEW_VALUES: ColumnValue[] = [
  { id: 'changesRequested', label: 'Changes requested', tone: 'red' },
  { id: 'unresolved', label: 'Unresolved threads', tone: 'purple' },
  { id: 'awaiting', label: 'Awaiting review', tone: 'amber' },
  { id: 'approved', label: 'Approved', tone: 'green' },
  { id: 'reviewed', label: 'Reviewed', tone: 'accent' },
  { id: 'notRequested', label: 'Not requested', tone: 'neutral' },
];

export const COLUMNS: ColumnDefinition[] = [
  {
    id: 'status',
    label: 'Status',
    values: [
      { id: 'draft', label: 'Draft', tone: 'neutral' },
      { id: 'ready', label: 'Ready', tone: 'green' },
      { id: 'merged', label: 'Merged', tone: 'purple' },
    ],
  },
  {
    id: 'author',
    label: 'Author',
    values: [
      { id: 'vip', label: 'VIP', tone: 'gold' },
      { id: 'other', label: 'Everyone else', tone: 'neutral' },
    ],
  },
  {
    id: 'checks',
    label: 'Checks',
    values: [
      { id: 'passing', label: 'Passing', tone: 'green' },
      { id: 'failing', label: 'Failing', tone: 'red' },
      { id: 'running', label: 'Running', tone: 'amber' },
      { id: 'none', label: 'None', tone: 'neutral' },
    ],
  },
  { id: 'human', label: 'Human review', values: REVIEW_VALUES },
  { id: 'bot', label: 'Bot review', values: REVIEW_VALUES },
];

// Every column holds a list, even the ones that can only ever hold one value, so a row and a
// group filter read the same shape whichever column they are asking about.
export type ColumnValues = Record<ColumnId, string[]>;

const valueIndex = new Map(
  COLUMNS.map((column) => [column.id, new Map(column.values.map((value) => [value.id, value]))]),
);

export const columnValue = (column: ColumnId, id: string): ColumnValue | null =>
  valueIndex.get(column)?.get(id) ?? null;

// Reviewed is what is left when a review happened and said nothing more specific: the other three
// verdicts already imply it, and repeating it beside them would be noise the filter has to match.
const reviewValues = (state: ReviewState): string[] => {
  const hasVerdict = state.hasChangesRequested || state.hasUnresolvedThreads || state.isApproved;
  const owned = [
    state.hasChangesRequested ? 'changesRequested' : '',
    state.hasUnresolvedThreads ? 'unresolved' : '',
    state.isRequested ? 'awaiting' : '',
    state.isApproved ? 'approved' : '',
    state.hasBeenReviewed && !hasVerdict ? 'reviewed' : '',
  ].filter(Boolean);

  return owned.length > 0 ? owned : ['notRequested'];
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

export const columnValuesFor = (pullRequest: PullRequest, isVipAuthor: boolean): ColumnValues => ({
  status: [pullRequest.state],
  author: [isVipAuthor ? 'vip' : 'other'],
  checks: [checksValue(pullRequest.checkState)],
  human: reviewValues(pullRequest.humanReview),
  bot: reviewValues(pullRequest.botReview),
});

export const matchesFilters = (values: ColumnValues, filters: GroupFilters): boolean =>
  COLUMNS.every((column) => {
    const selected = filters[column.id];
    if (!selected || selected.length === 0) return true;
    return selected.some((value) => values[column.id].includes(value));
  });

// Selecting every value in a column is indistinguishable from selecting none, so it is stored as
// none: the editor and the summary then have one shape to read rather than two.
export const normalizeFilters = (raw: unknown): GroupFilters => {
  if (typeof raw !== 'object' || raw === null) return {};
  const source = raw as Record<string, unknown>;
  const filters: GroupFilters = {};

  for (const column of COLUMNS) {
    const selected = source[column.id];
    if (!Array.isArray(selected)) continue;
    const kept = column.values.map((value) => value.id).filter((id) => selected.includes(id));
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

  return parts.length > 0 ? parts.join(' + ') : 'every pull request in scope';
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
