import type { ReviewState } from '../shared/types.js';

interface Actor {
  __typename?: string;
  login?: string;
}

export interface ReviewInput {
  reviews: { nodes: { author: Actor | null }[] };
  latestOpinionatedReviews: { nodes: { author: Actor | null; state: string }[] };
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
  hasReviews: boolean;
  isApproved: boolean;
  hasChangesRequested: boolean;
  openThreadCount: number;
  closedThreadCount: number;
}

export interface SignalOptions {
  isBot: (actor: Actor | null | undefined) => boolean;
  wantBots: boolean;
  isRequested: boolean;
}

const hasBeenReviewed = (signals: ReviewSignals): boolean =>
  signals.hasReviews || signals.openThreadCount > 0 || signals.closedThreadCount > 0;

// Every fact is recorded independently rather than ranked here, so a pull request that has been
// reviewed once and still owes another review keeps both, and the column decides which to show.
export const reviewStateFor = (signals: ReviewSignals): ReviewState => ({
  isRequested: signals.isRequested,
  hasBeenReviewed: hasBeenReviewed(signals),
  hasUnresolvedThreads: signals.openThreadCount > 0,
  hasChangesRequested: signals.hasChangesRequested,
  isApproved: signals.isApproved,
});

export const signalsFor = (input: ReviewInput, options: SignalOptions): ReviewSignals => {
  const owned = (actor: Actor | null | undefined) => options.isBot(actor) === options.wantBots;
  const latest = input.latestOpinionatedReviews.nodes.filter((review) => owned(review.author));
  const threads = input.reviewThreads.nodes.filter((thread) => owned(thread.comments.nodes[0]?.author));

  return {
    isRequested: options.isRequested,
    hasReviews: input.reviews.nodes.some((review) => owned(review.author)),
    isApproved:
      latest.some((review) => review.state === 'APPROVED') &&
      !latest.some((review) => review.state === 'CHANGES_REQUESTED'),
    hasChangesRequested: latest.some((review) => review.state === 'CHANGES_REQUESTED'),
    openThreadCount: threads.filter((thread) => !thread.isResolved && !thread.isOutdated).length,
    closedThreadCount: threads.filter((thread) => thread.isResolved || thread.isOutdated).length,
  };
};
