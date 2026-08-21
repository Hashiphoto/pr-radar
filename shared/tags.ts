import type { PullRequest, ReviewStage, ReviewState } from './types.js';

export interface TagDefinition {
  id: string;
  label: string;
}

export interface TagDimension {
  id: string;
  label: string;
  tags: TagDefinition[];
}

type ReviewSide = 'human' | 'bot';

// Humans and bots offer the same six choices, so "no unresolved threads" means the same thing
// whichever side you ask it of.
const REVIEW_TAGS = [
  { suffix: 'NotRequested', label: 'Not requested' },
  { suffix: 'Awaiting', label: 'Awaiting review' },
  { suffix: 'Reviewed', label: 'Reviewed' },
  { suffix: 'UnresolvedThreads', label: 'Unresolved threads' },
  { suffix: 'NoUnresolvedThreads', label: 'No unresolved threads' },
  { suffix: 'Approved', label: 'Approved' },
] as const;

const reviewTagId = (side: ReviewSide, suffix: string): string => `${side}${suffix}`;

const reviewDimension = (side: ReviewSide, label: string): TagDimension => ({
  id: `${side}Review`,
  label,
  tags: REVIEW_TAGS.map((tag) => ({ id: reviewTagId(side, tag.suffix), label: tag.label })),
});

// A group matches with OR inside a dimension and AND across dimensions. Most dimensions are
// exhaustive and exclusive; the review ones overlap on purpose, so Reviewed can be asked
// independently of the thread and approval state it coexists with.
export const TAG_DIMENSIONS: TagDimension[] = [
  {
    id: 'state',
    label: 'Status',
    tags: [
      { id: 'ready', label: 'Ready' },
      { id: 'draft', label: 'Draft' },
    ],
  },
  {
    id: 'author',
    label: 'Author',
    tags: [
      { id: 'vipAuthor', label: 'VIP' },
      { id: 'otherAuthor', label: 'Everyone else' },
    ],
  },
  {
    id: 'approval',
    label: 'Approval',
    tags: [
      { id: 'approved', label: 'Approved' },
      { id: 'notApproved', label: 'Not approved' },
    ],
  },
  reviewDimension('human', 'Human review'),
  reviewDimension('bot', 'Bot review'),
  {
    id: 'checks',
    label: 'Checks',
    tags: [
      { id: 'checksPassing', label: 'Passing' },
      { id: 'checksFailing', label: 'Failing' },
      { id: 'checksRunning', label: 'Running' },
      { id: 'checksNone', label: 'None' },
    ],
  },
  {
    id: 'mergeability',
    label: 'Mergeability',
    tags: [
      { id: 'mergeable', label: 'No conflicts' },
      { id: 'conflicting', label: 'Conflicts' },
      { id: 'mergeabilityUnknown', label: 'Unknown' },
    ],
  },
];

const stageSuffix: Record<ReviewStage, string> = {
  notRequested: 'NotRequested',
  awaiting: 'Awaiting',
  reviewed: 'Reviewed',
};

const reviewTagsFor = (side: ReviewSide, state: ReviewState): string[] => [
  reviewTagId(side, stageSuffix[state.stage]),
  reviewTagId(side, state.hasUnresolvedThreads ? 'UnresolvedThreads' : 'NoUnresolvedThreads'),
  ...(state.isApproved ? [reviewTagId(side, 'Approved')] : []),
];

const checksTag = (checkState: PullRequest['checkState']): string => {
  switch (checkState) {
    case 'SUCCESS':
      return 'checksPassing';
    case 'FAILURE':
    case 'ERROR':
      return 'checksFailing';
    case 'PENDING':
    case 'EXPECTED':
      return 'checksRunning';
    default:
      return 'checksNone';
  }
};

const mergeabilityTag = (mergeable: PullRequest['mergeable']): string => {
  if (mergeable === 'MERGEABLE') return 'mergeable';
  if (mergeable === 'CONFLICTING') return 'conflicting';
  return 'mergeabilityUnknown';
};

export const tagsFor = (pullRequest: PullRequest, isVipAuthor: boolean): string[] => [
  pullRequest.isDraft ? 'draft' : 'ready',
  isVipAuthor ? 'vipAuthor' : 'otherAuthor',
  pullRequest.reviewDecision === 'APPROVED' ? 'approved' : 'notApproved',
  ...reviewTagsFor('human', pullRequest.humanReview),
  ...reviewTagsFor('bot', pullRequest.botReview),
  checksTag(pullRequest.checkState),
  mergeabilityTag(pullRequest.mergeable),
];

export const matchesTags = (tags: string[], selected: string[]): boolean => {
  if (selected.length === 0) return true;
  const owned = new Set(tags);

  return TAG_DIMENSIONS.every((dimension) => {
    const wanted = dimension.tags.filter((tag) => selected.includes(tag.id));
    return wanted.length === 0 || wanted.some((tag) => owned.has(tag.id));
  });
};

const labels = new Map(
  TAG_DIMENSIONS.flatMap((dimension) =>
    dimension.tags.map((tag) => [tag.id, `${dimension.label}: ${tag.label}`] as const),
  ),
);

export const knownTagIds = new Set(labels.keys());

// A saved group naming a retired tag would silently match nothing, so the ids that were renamed
// rather than dropped are carried across instead.
const renamedTagIds: Record<string, string> = {
  humanOpenComments: 'humanUnresolvedThreads',
  humanAddressedComments: 'humanNoUnresolvedThreads',
  botNotReviewed: 'botNotRequested',
  botOpenComments: 'botUnresolvedThreads',
  botAddressedComments: 'botNoUnresolvedThreads',
};

export const canonicalTagId = (id: string): string => renamedTagIds[id] ?? id;
