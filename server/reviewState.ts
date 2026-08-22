import type { ReviewState } from '../shared/types.js';

interface Actor {
  __typename?: string;
  login?: string;
}

export interface ReviewInput {
  reviews: { nodes: { author: Actor | null }[] };
  latestOpinionatedReviews: { nodes: { author: Actor | null; state: string }[] };
  reviewRequests: { nodes: { requestedReviewer: { __typename: string; login?: string } | null }[] };
  reviewThreads: {
    nodes: {
      isResolved: boolean;
      isOutdated: boolean;
      comments: { nodes: { author: Actor | null }[] };
    }[];
  };
}

export interface ReviewSignals {
  isRequested: boolean;
  hasCurrentReview: boolean;
  isApproved: boolean;
  hasChangesRequested: boolean;
  openThreadCount: number;
}

export interface SignalOptions {
  isBot: (actor: Actor | null | undefined) => boolean;
  wantBots: boolean;
  isRequested: boolean;
  authorLogin: string | null;
}

// Every fact is recorded independently rather than ranked here, so a pull request that has been
// reviewed once and still owes another review keeps both, and the column decides which to show.
export const reviewStateFor = (signals: ReviewSignals): ReviewState => ({
  isRequested: signals.isRequested,
  hasBeenReviewed: signals.hasCurrentReview,
  hasUnresolvedThreads: signals.openThreadCount > 0,
  hasChangesRequested: signals.hasChangesRequested,
  isApproved: signals.isApproved,
  openThreadCount: signals.openThreadCount,
});

// GitHub clears a request the moment that reviewer weighs in, so a request standing for someone who
// already reviewed is a re-request, and what they said is about work that is no longer the work.
const supersededLogins = (input: ReviewInput): Set<string> =>
  new Set(
    input.reviewRequests.nodes
      .map((request) => request.requestedReviewer?.login)
      .filter((login): login is string => login !== undefined),
  );

// An author answering a bot on their own pull request is recorded as a COMMENTED review, and their
// own thread is not feedback they are waiting on, so neither counts as a review of the work.
export const signalsFor = (input: ReviewInput, options: SignalOptions): ReviewSignals => {
  const superseded = supersededLogins(input);
  const isAuthor = (actor: Actor | null | undefined) =>
    options.authorLogin !== null && actor?.login === options.authorLogin;
  const owned = (actor: Actor | null | undefined) =>
    options.isBot(actor) === options.wantBots && !isAuthor(actor);
  const stands = (actor: Actor | null | undefined) =>
    owned(actor) && !(actor?.login !== undefined && superseded.has(actor.login));
  const latest = input.latestOpinionatedReviews.nodes.filter((review) => stands(review.author));
  const threads = input.reviewThreads.nodes.filter((thread) => owned(thread.comments.nodes[0]?.author));

  return {
    isRequested: options.isRequested,
    hasCurrentReview:
      input.reviews.nodes.some((review) => stands(review.author)) ||
      threads.some((thread) => stands(thread.comments.nodes[0]?.author)),
    isApproved:
      latest.some((review) => review.state === 'APPROVED') &&
      !latest.some((review) => review.state === 'CHANGES_REQUESTED'),
    hasChangesRequested: latest.some((review) => review.state === 'CHANGES_REQUESTED'),
    // A thread left open is open feedback whether or not the review it came from still stands.
    openThreadCount: threads.filter((thread) => !thread.isResolved && !thread.isOutdated).length,
  };
};
