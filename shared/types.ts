import type { GroupFilters } from './columns.js';

export type CheckState = 'SUCCESS' | 'FAILURE' | 'PENDING' | 'ERROR' | 'EXPECTED' | null;

export type ReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;

export type MergeableState = 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN' | null;

export type MyReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | null;

export type PrState = 'draft' | 'ready';

// Humans and bots get the same shape so a group can ask the same question of either. These are
// independent facts rather than one stage, because a pull request that was reviewed once can still
// owe another review, and collapsing the two loses the outstanding request.
export interface ReviewState {
  isRequested: boolean;
  hasBeenReviewed: boolean;
  hasUnresolvedThreads: boolean;
  hasChangesRequested: boolean;
  isApproved: boolean;
  openThreadCount: number;
}

export interface Label {
  name: string;
  color: string;
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  url: string;
  headRefName: string;
  state: PrState;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  reviewDecision: ReviewDecision;
  mergeable: MergeableState;
  checkState: CheckState;
  author: { login: string; avatarUrl: string } | null;
  repository: string;
  owner: string;
  labels: Label[];
  requestedFromMeDirectly: boolean;
  requestedTeams: string[];
  approvalCount: number;
  changesRequestedCount: number;
  myReviewState: MyReviewState;
  humanReview: ReviewState;
  botReview: ReviewState;
  isVip: boolean;
}

export interface Snapshot {
  viewer: { login: string; avatarUrl: string };
  fetchedAt: string;
  incoming: PullRequest[];
  mine: PullRequest[];
  dismissed: PullRequest[];
  rateLimit: { remaining: number; limit: number; resetAt: string } | null;
  warnings: string[];
}

export interface Group {
  id: string;
  name: string;
  filters: GroupFilters;
  notifyOnNew: boolean;
  hue: number | null;
}

export interface Settings {
  vips: string[];
  pollSeconds: number;
  orgs: string[];
  includeTeamRequests: boolean;
  jiraBaseUrl: string;
  botReviewComment: string;
  bots: string[];
  groups: Group[];
}

export interface DismissedEntry {
  id: string;
  url: string;
  title: string;
  repository: string;
  number: number;
  dismissedAt: string;
}

export interface FailedTask {
  name: string;
  stage: string | null;
  errorLines: string[];
  webUrl: string;
}

export interface BuildFailure {
  organization: string;
  project: string;
  buildId: string;
  definitionName: string;
  isComplete: boolean;
  webUrl: string;
  failedStages: { identifier: string; name: string }[];
  failedTasks: FailedTask[];
  truncatedTaskCount: number;
}

export interface FailingCheck {
  name: string;
  checkRunId: number | null;
  detailsUrl: string | null;
  isRerunnableOnGithub: boolean;
  build: BuildFailure | null;
}

export interface ChecksReport {
  repository: string;
  number: number;
  checks: FailingCheck[];
  adoError: string | null;
}

export interface RetryResult {
  message: string;
}

export interface ServiceInfo {
  name: string;
  version: string;
  pid: number;
  port: number;
  host: string;
  uptimeSeconds: number;
  startedAt: string;
  managedBy: 'systemd' | 'manual';
  unit: string;
  projectRoot: string;
  configFile: string;
  nodeVersion: string;
}
