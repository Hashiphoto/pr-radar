import type {
  BuildFailure,
  ChecksReport,
  PullRequest,
  ServiceInfo,
  Snapshot,
} from '../shared/types.js';

export const isDemoMode = process.env.PR_RADAR_DEMO === '1';

const palette = ['#4c6ef5', '#12b886', '#e8590c', '#ae3ec9', '#1098ad', '#f59f00'];

const avatarFor = (login: string): string => {
  const initials = login.slice(0, 2).toUpperCase();
  const color = palette[login.length % palette.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="${color}"/><text x="20" y="26" font-family="sans-serif" font-size="16" font-weight="600" fill="#fff" text-anchor="middle">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 3_600_000).toISOString();

interface Seed {
  number: number;
  title: string;
  author: string;
  repository: string;
  openedHoursAgo: number;
  updatedHoursAgo: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  isDraft?: boolean;
  reviewDecision?: PullRequest['reviewDecision'];
  checkState?: PullRequest['checkState'];
  mergeable?: PullRequest['mergeable'];
  approvalCount?: number;
  unresolvedThreadCount?: number;
  requestedTeams?: string[];
  requestedFromMeDirectly?: boolean;
  isVip?: boolean;
}

const toPr = (seed: Seed): PullRequest => ({
  id: `demo-${seed.repository}-${seed.number}`,
  number: seed.number,
  title: seed.title,
  url: `https://github.com/${seed.repository}/pull/${seed.number}`,
  isDraft: seed.isDraft ?? false,
  createdAt: hoursAgo(seed.openedHoursAgo),
  updatedAt: hoursAgo(seed.updatedHoursAgo),
  additions: seed.additions,
  deletions: seed.deletions,
  changedFiles: seed.changedFiles,
  reviewDecision: seed.reviewDecision ?? 'REVIEW_REQUIRED',
  mergeable: seed.mergeable ?? 'MERGEABLE',
  checkState: seed.checkState ?? 'SUCCESS',
  author: { login: seed.author, avatarUrl: avatarFor(seed.author) },
  repository: seed.repository,
  owner: seed.repository.split('/')[0] ?? 'acme',
  labels: [],
  requestedFromMeDirectly: seed.requestedFromMeDirectly ?? false,
  requestedTeams: seed.requestedTeams ?? [],
  approvalCount: seed.approvalCount ?? 0,
  changesRequestedCount: seed.reviewDecision === 'CHANGES_REQUESTED' ? 1 : 0,
  unresolvedThreadCount: seed.unresolvedThreadCount ?? 0,
  myReviewState: null,
  isVip: seed.isVip ?? false,
});

const vipReviews: Seed[] = [
  {
    number: 4821,
    title: 'Cache tenant feature flags at the edge instead of per request',
    author: 'marina-ok',
    repository: 'acme/platform',
    openedHoursAgo: 560,
    updatedHoursAgo: 26,
    additions: 415,
    deletions: 0,
    changedFiles: 6,
    reviewDecision: 'APPROVED',
    approvalCount: 1,
    checkState: 'FAILURE',
    requestedFromMeDirectly: true,
    isVip: true,
  },
  {
    number: 4830,
    title: 'Back the audit export with a cursor instead of an offset',
    author: 'marina-ok',
    repository: 'acme/platform',
    openedHoursAgo: 150,
    updatedHoursAgo: 25,
    additions: 722,
    deletions: 51,
    changedFiles: 14,
    requestedTeams: ['storage'],
    isVip: true,
  },
];

const incomingReviews: Seed[] = [
  {
    number: 1187,
    title: 'Add the in-app announcement widget',
    author: 'dperez',
    repository: 'acme/webapp',
    openedHoursAgo: 128,
    updatedHoursAgo: 13,
    additions: 989,
    deletions: 49,
    changedFiles: 48,
    checkState: 'FAILURE',
    requestedTeams: ['growth'],
  },
  {
    number: 1190,
    title: 'Sign messenger sessions with short-lived JWTs',
    author: 'dperez',
    repository: 'acme/webapp',
    openedHoursAgo: 96,
    updatedHoursAgo: 70,
    additions: 352,
    deletions: 11,
    changedFiles: 20,
    requestedTeams: ['growth'],
  },
  {
    number: 612,
    title: 'Render assignee and group columns in the recurring task grid',
    author: 'sam-oakes',
    repository: 'acme/connectors',
    openedHoursAgo: 30,
    updatedHoursAgo: 11,
    additions: 195,
    deletions: 27,
    changedFiles: 2,
    requestedFromMeDirectly: true,
  },
  {
    number: 615,
    title: 'Route knowledge base questions to the research agent',
    author: 'priya-n',
    repository: 'acme/connectors',
    openedHoursAgo: 14,
    updatedHoursAgo: 13,
    additions: 368,
    deletions: 72,
    changedFiles: 6,
    requestedTeams: ['platform'],
  },
];

const mine: Seed[] = [
  {
    number: 4835,
    title: 'Thread a request context through the ingest workers',
    author: 'octo-dev',
    repository: 'acme/platform',
    openedHoursAgo: 72,
    updatedHoursAgo: 13,
    additions: 547,
    deletions: 255,
    changedFiles: 21,
  },
  {
    number: 4802,
    title: 'Stop mention suggestions from stretching their container',
    author: 'octo-dev',
    repository: 'acme/webapp',
    openedHoursAgo: 190,
    updatedHoursAgo: 24,
    additions: 23,
    deletions: 1,
    changedFiles: 2,
  },
  {
    number: 4640,
    title: 'Sort the generated chart config deterministically',
    author: 'octo-dev',
    repository: 'acme/platform',
    openedHoursAgo: 4300,
    updatedHoursAgo: 70,
    additions: 8200,
    deletions: 7600,
    changedFiles: 21,
    mergeable: 'CONFLICTING',
  },
  {
    number: 620,
    title: 'Retry throttled webhook deliveries with jitter',
    author: 'octo-dev',
    repository: 'acme/connectors',
    openedHoursAgo: 100,
    updatedHoursAgo: 9,
    additions: 289,
    deletions: 12,
    changedFiles: 9,
    reviewDecision: 'APPROVED',
    approvalCount: 2,
  },
  {
    number: 4790,
    title: 'Require an explicit owner when creating a workspace',
    author: 'octo-dev',
    repository: 'acme/platform',
    openedHoursAgo: 96,
    updatedHoursAgo: 8,
    additions: 341,
    deletions: 0,
    changedFiles: 5,
    reviewDecision: 'APPROVED',
    approvalCount: 1,
    checkState: 'PENDING',
  },
  {
    number: 4771,
    title: 'Surface a clearer error when the linked instance was deleted',
    author: 'octo-dev',
    repository: 'acme/platform',
    openedHoursAgo: 78,
    updatedHoursAgo: 18,
    additions: 398,
    deletions: 54,
    changedFiles: 8,
    reviewDecision: 'APPROVED',
    approvalCount: 1,
    checkState: 'FAILURE',
    unresolvedThreadCount: 2,
  },
  {
    number: 4844,
    title: 'Replace the bundler with an incremental build pipeline',
    author: 'octo-dev',
    repository: 'acme/webapp',
    openedHoursAgo: 120,
    updatedHoursAgo: 9,
    additions: 21400,
    deletions: 13900,
    changedFiles: 151,
    isDraft: true,
    checkState: 'FAILURE',
  },
  {
    number: 630,
    title: 'Add a mock task connector for internal testing',
    author: 'octo-dev',
    repository: 'acme/connectors',
    openedHoursAgo: 92,
    updatedHoursAgo: 26,
    additions: 1000,
    deletions: 11,
    changedFiles: 35,
    isDraft: true,
  },
];

export const demoSnapshot = (vips: string[]): Snapshot => {
  const vipSet = new Set(vips.map((login) => login.toLowerCase()));
  const decorate = (seed: Seed): PullRequest => {
    const pr = toPr(seed);
    return { ...pr, isVip: vipSet.has(seed.author.toLowerCase()) || Boolean(seed.isVip) };
  };

  const mineDecorated = mine.map(decorate);

  return {
    viewer: { login: 'octo-dev', avatarUrl: avatarFor('octo-dev') },
    fetchedAt: new Date().toISOString(),
    vipReviews: vipReviews.map(decorate),
    incomingReviews: incomingReviews.map(decorate),
    dismissedReviews: [],
    myPrs: {
      changesRequested: [],
      awaitingReview: mineDecorated.filter(
        (pr) => !pr.isDraft && pr.reviewDecision === 'REVIEW_REQUIRED',
      ),
      approved: mineDecorated.filter((pr) => !pr.isDraft && pr.reviewDecision === 'APPROVED'),
      draft: mineDecorated.filter((pr) => pr.isDraft),
    },
    rateLimit: {
      remaining: 4862,
      limit: 5000,
      resetAt: new Date(Date.now() + 36 * 60_000).toISOString(),
    },
    warnings: [],
  };
};

const demoBuild = (buildId: string, definitionName: string, stage: string): BuildFailure => ({
  organization: 'acme',
  project: 'acme-ci',
  buildId,
  definitionName,
  isComplete: true,
  webUrl: `https://dev.azure.com/acme/acme-ci/_build/results?buildId=${buildId}`,
  failedStages: [{ identifier: stage, name: stage }],
  failedTasks: [
    {
      name: 'Test web client',
      stage,
      errorLines: [
        'FAIL src/app/components/dataGrid/tests/PagedGrid.unit.test.tsx (13.834 s)',
        '● PagedGrid › loadPage › discards a stale reset()-raced response',
        '● PagedGrid › fetchAll › discards a stale response when reset() keeps the fingerprint',
        '● PagedGrid › fetchAll › waits for an in-flight loadPage before fetching',
        'Test Suites: 1 failed, 1 skipped, 772 passed, 773 of 774 total',
        'Tests:       4 failed, 15 skipped, 14301 passed, 14320 total',
      ],
      webUrl: `https://dev.azure.com/acme/acme-ci/_build/results?buildId=${buildId}&view=logs`,
    },
  ],
  truncatedTaskCount: 0,
});

export const demoChecks = (repository: string, number: number): ChecksReport => ({
  repository,
  number,
  adoError: null,
  checks: [
    {
      name: 'Web CI',
      checkRunId: 1,
      detailsUrl: 'https://dev.azure.com/acme/acme-ci/_build/results?buildId=48213',
      isRerunnableOnGithub: true,
      build: demoBuild('48213', 'Web CI', 'WebProjects'),
    },
  ],
});

export const demoService = (port: number): ServiceInfo => ({
  name: 'pr-radar',
  version: '0.1.0',
  pid: 4242,
  port,
  host: 'workstation',
  uptimeSeconds: 7_320,
  startedAt: new Date(Date.now() - 7_320_000).toISOString(),
  managedBy: 'systemd',
  unit: 'pr-radar.service',
  projectRoot: '/home/you/Git/pr-radar',
  stateFile: '/home/you/.config/pr-radar/state.json',
  nodeVersion: 'v22.21.1',
});
