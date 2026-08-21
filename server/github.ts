import type {
  CheckState,
  MergeableState,
  MyReviewState,
  PullRequest,
  ReviewDecision,
  Settings,
  Snapshot,
} from '../shared/types.js';
import { githubGraphqlWithWarnings } from './githubClient.js';
import { reviewStateFor, signalsFor } from './reviewState.js';

const prFields = `
  id
  number
  title
  url
  headRefName
  isDraft
  createdAt
  updatedAt
  additions
  deletions
  changedFiles
  reviewDecision
  mergeable
  author { __typename login avatarUrl }
  repository { nameWithOwner owner { login } }
  labels(first: 12) { nodes { name color } }
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  reviewRequests(first: 25) {
    nodes { requestedReviewer { __typename ... on User { login } ... on Team { name } } }
  }
  latestOpinionatedReviews(first: 50) { nodes { author { __typename login } state } }
  reviews(first: 60) { nodes { author { __typename login } state } }
  reviewThreads(first: 100) {
    nodes {
      isResolved
      isOutdated
      comments(first: 1) { nodes { author { __typename login } } }
    }
  }
`;

const query = `
query PrRadar($reviewRequested: String!, $authored: String!) {
  viewer { login avatarUrl }
  reviewRequested: search(query: $reviewRequested, type: ISSUE, first: 60) {
    issueCount
    nodes { ... on PullRequest { ${prFields} } }
  }
  authored: search(query: $authored, type: ISSUE, first: 60) {
    issueCount
    nodes { ... on PullRequest { ${prFields} } }
  }
  rateLimit { remaining limit resetAt }
}
`;

interface RawActor {
  __typename?: string;
  login?: string;
  avatarUrl?: string;
}

interface RawPullRequest {
  id: string;
  number: number;
  title: string;
  url: string;
  headRefName: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  reviewDecision: ReviewDecision;
  mergeable: MergeableState;
  author: RawActor | null;
  repository: { nameWithOwner: string; owner: { login: string } };
  labels: { nodes: { name: string; color: string }[] };
  commits: { nodes: { commit: { statusCheckRollup: { state: CheckState } | null } }[] };
  reviewRequests: { nodes: { requestedReviewer: { __typename: string; login?: string; name?: string } | null }[] };
  latestOpinionatedReviews: { nodes: { author: RawActor | null; state: string }[] };
  reviews: { nodes: { author: RawActor | null; state: string }[] };
  reviewThreads: {
    nodes: {
      isResolved: boolean;
      isOutdated: boolean;
      comments: { nodes: { author: RawActor | null }[] };
    }[];
  };
}

interface SearchResult {
  issueCount: number;
  nodes: (RawPullRequest | null)[];
}

interface SnapshotData {
  viewer: { login: string; avatarUrl: string };
  reviewRequested: SearchResult;
  authored: SearchResult;
  rateLimit: { remaining: number; limit: number; resetAt: string } | null;
}

const knownBots = new Set(['coderabbitai', 'unblocked', 'github-actions', 'dependabot', 'sonarcloud']);

const isBot = (actor: RawActor | null | undefined): boolean => {
  if (!actor) return false;
  if (actor.__typename === 'Bot') return true;
  const login = actor.login ?? '';
  return login.endsWith('[bot]') || knownBots.has(login.toLowerCase());
};

const buildSearchQuery = (base: string, orgs: string[]): string =>
  [base, 'is:open', 'is:pr', 'archived:false', ...orgs.map((org) => `org:${org}`)].join(' ');

const toPullRequest = (raw: RawPullRequest, viewerLogin: string): PullRequest => {
  // Bot verdicts have their own dimension, so the approval tally counts people only.
  const countableReviews = raw.latestOpinionatedReviews.nodes.filter(
    (review) => !isBot(review.author),
  );

  const requestedLogins = raw.reviewRequests.nodes
    .map((request) => request.requestedReviewer)
    .filter((reviewer): reviewer is { __typename: string; login?: string; name?: string } => reviewer !== null);

  const myReview = raw.reviews.nodes.find((review) => review.author?.login === viewerLogin);
  const isRequestedBot = (reviewer: { __typename: string; login?: string }) =>
    reviewer.__typename !== 'Team' && isBot(reviewer);
  const hasHumanRequest = requestedLogins.some((reviewer) => !isRequestedBot(reviewer));
  const hasBotRequest = requestedLogins.some(isRequestedBot);

  return {
    id: raw.id,
    number: raw.number,
    title: raw.title,
    url: raw.url,
    headRefName: raw.headRefName,
    isDraft: raw.isDraft,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    additions: raw.additions,
    deletions: raw.deletions,
    changedFiles: raw.changedFiles,
    reviewDecision: raw.reviewDecision,
    mergeable: raw.mergeable,
    checkState: raw.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null,
    author: raw.author?.login ? { login: raw.author.login, avatarUrl: raw.author.avatarUrl ?? '' } : null,
    repository: raw.repository.nameWithOwner,
    owner: raw.repository.owner.login,
    labels: raw.labels.nodes,
    requestedFromMeDirectly: requestedLogins.some(
      (reviewer) => reviewer.__typename === 'User' && reviewer.login === viewerLogin,
    ),
    requestedTeams: requestedLogins
      .filter((reviewer) => reviewer.__typename === 'Team')
      .map((reviewer) => reviewer.name ?? 'team'),
    approvalCount: countableReviews.filter((review) => review.state === 'APPROVED').length,
    changesRequestedCount: countableReviews.filter((review) => review.state === 'CHANGES_REQUESTED').length,
    unresolvedThreadCount: raw.reviewThreads.nodes.filter((thread) => !thread.isResolved && !thread.isOutdated).length,
    myReviewState: (myReview?.state as MyReviewState) ?? null,
    humanReview: reviewStateFor(signalsFor(raw, { isBot, wantBots: false, isRequested: hasHumanRequest })),
    botReview: reviewStateFor(signalsFor(raw, { isBot, wantBots: true, isRequested: hasBotRequest })),
    isVip: false,
  };
};

const byUpdatedDescending = (left: PullRequest, right: PullRequest): number =>
  Date.parse(right.updatedAt) - Date.parse(left.updatedAt);

const byOldestFirst = (left: PullRequest, right: PullRequest): number =>
  Date.parse(left.createdAt) - Date.parse(right.createdAt);

export const fetchSnapshot = async (
  settings: Settings,
  dismissedIds: Set<string>,
): Promise<Snapshot> => {
  const reviewRequestedTerm = settings.includeTeamRequests
    ? 'review-requested:@me'
    : 'user-review-requested:@me';

  const { data, warnings } = await githubGraphqlWithWarnings<SnapshotData>(query, {
    reviewRequested: buildSearchQuery(reviewRequestedTerm, settings.orgs),
    authored: buildSearchQuery('author:@me', settings.orgs),
  });

  const viewerLogin = data.viewer.login;
  const vipSet = new Set(settings.vips.map((login) => login.toLowerCase()));

  const mapNodes = (nodes: (RawPullRequest | null)[]): PullRequest[] =>
    nodes
      .filter((node): node is RawPullRequest => node !== null)
      .map((node) => {
        const pullRequest = toPullRequest(node, viewerLogin);
        return { ...pullRequest, isVip: vipSet.has(pullRequest.author?.login.toLowerCase() ?? '') };
      });

  const incoming = mapNodes(data.reviewRequested.nodes).filter(
    (pullRequest) => pullRequest.author?.login !== viewerLogin,
  );
  const mine = mapNodes(data.authored.nodes);

  // A silently truncated list reads as "you are all caught up", which is the one thing
  // this dashboard must never get wrong.
  const truncation = [
    { label: 'review requests', result: data.reviewRequested },
    { label: 'of your pull requests', result: data.authored },
  ]
    .filter((entry) => entry.result.issueCount > entry.result.nodes.length)
    .map(
      (entry) =>
        `Showing ${entry.result.nodes.length} of ${entry.result.issueCount} ${entry.label}. Narrow the search with an organization filter.`,
    );

  const dismissed = incoming.filter((pullRequest) => dismissedIds.has(pullRequest.id));
  const active = incoming.filter((pullRequest) => !dismissedIds.has(pullRequest.id));

  return {
    viewer: data.viewer,
    fetchedAt: new Date().toISOString(),
    incoming: active.sort(byOldestFirst),
    mine: [...mine].sort(byUpdatedDescending),
    dismissed: dismissed.sort(byUpdatedDescending),
    rateLimit: data.rateLimit,
    warnings: [...warnings, ...truncation],
  };
};

export const collectLiveIds = (snapshot: Snapshot): Set<string> =>
  new Set(
    [...snapshot.incoming, ...snapshot.dismissed].map((pullRequest) => pullRequest.id),
  );
