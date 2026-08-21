import type { PullRequest, ReviewState } from './types.js';

export type Tone = 'neutral' | 'green' | 'red' | 'amber' | 'purple' | 'accent' | 'gold';

export type ColumnId = 'status' | 'author' | 'checks' | 'human' | 'bot';

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

// Verdicts coexist on purpose — a pull request can be approved and still have a thread open — so a
// row carries every one it owns. Declaration order is display order, most blocking first, so the
// first pill in the cell is the one to act on.
const REVIEW_VALUES: ColumnValue[] = [
  {
    id: 'changesRequested',
    label: 'Changes requested',
    tone: 'red',
    rule: 'The latest verdict from at least one reviewer asks for changes.',
  },
  {
    id: 'unresolved',
    label: 'Unresolved threads',
    tone: 'purple',
    rule: 'A review thread is open and not outdated. The count is threads on this side only.',
  },
  {
    id: 'awaiting',
    label: 'Awaiting review',
    tone: 'amber',
    rule: 'A review is requested and none has landed yet, so every request is still outstanding. Never shown beside a value that says a review landed.',
  },
  {
    id: 'approved',
    label: 'Approved',
    tone: 'green',
    rule: 'At least one latest verdict approves and none asks for changes. The count is how many approved.',
  },
  {
    id: 'reviewed',
    label: 'Reviewed',
    tone: 'accent',
    rule: 'A review landed and left nothing outstanding: no approval, no changes requested, no open thread.',
  },
  {
    id: 'notRequested',
    label: 'Not requested',
    tone: 'neutral',
    rule: 'Nothing requested and nothing ever reviewed.',
  },
];

const humanNote =
  'Counts people only, and never the author: answering a bot on your own pull request is recorded as a review, and a thread you opened is not feedback you are waiting on.';

const botNote =
  'Counts bots only, so a CodeRabbit nit never reads as a human blocking you. On a draft, Not requested is a button that asks the bot configured in settings.';

export const COLUMNS: ColumnDefinition[] = [
  {
    id: 'status',
    label: 'Status',
    values: [
      { id: 'draft', label: 'Draft', tone: 'neutral', rule: 'Open and marked as a draft.' },
      { id: 'ready', label: 'Ready', tone: 'green', rule: 'Open and out of draft.' },
      {
        id: 'merged',
        label: 'Merged',
        tone: 'purple',
        rule: 'Yours, merged within the last 14 days. Anything older is never fetched, and pull requests closed without merging are not either.',
      },
    ],
  },
  {
    id: 'author',
    label: 'Author',
    values: [
      {
        id: 'vip',
        label: 'VIP',
        tone: 'gold',
        rule: 'The author is on your VIP list. Star anyone in the Author column to put them there.',
      },
      { id: 'other', label: 'Everyone else', tone: 'neutral', rule: 'Every other author.' },
    ],
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
  { id: 'human', label: 'Human review', values: REVIEW_VALUES, note: humanNote },
  { id: 'bot', label: 'Bot review', values: REVIEW_VALUES, note: botNote },
];

// Every column holds a list, even the ones that can only ever hold one value, so a row and a
// group filter read the same shape whichever column they are asking about.
export type ColumnValues = Record<ColumnId, string[]>;

const valueIndex = new Map(
  COLUMNS.map((column) => [column.id, new Map(column.values.map((value) => [value.id, value]))]),
);

export const columnValue = (column: ColumnId, id: string): ColumnValue | null =>
  valueIndex.get(column)?.get(id) ?? null;

// Awaiting review means every request is still outstanding, so it never sits beside a value that
// says a review already landed. Reviewed is in turn what is left once a review landed and said
// nothing more specific, since the three verdicts already imply it.
const reviewValues = (state: ReviewState): string[] => {
  if (!state.hasBeenReviewed) return state.isRequested ? ['awaiting'] : ['notRequested'];

  const owned = [
    state.hasChangesRequested ? 'changesRequested' : '',
    state.hasUnresolvedThreads ? 'unresolved' : '',
    state.isApproved ? 'approved' : '',
  ].filter(Boolean);

  return owned.length > 0 ? owned : ['reviewed'];
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
