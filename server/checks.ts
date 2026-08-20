import type { ChecksReport, FailingCheck } from '../shared/types.js';
import {
  AzureDevOpsUnavailableError,
  fetchBuildFailure,
  parseBuildUrl,
} from './azureDevops.js';
import { githubGraphql, githubRest } from './githubClient.js';

const query = `
query FailingChecks($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              contexts(first: 100) {
                nodes {
                  __typename
                  ... on StatusContext { context state targetUrl }
                  ... on CheckRun {
                    databaseId
                    name
                    conclusion
                    detailsUrl
                    checkSuite { app { slug } }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`;

interface RawContext {
  __typename: string;
  context?: string;
  state?: string;
  targetUrl?: string | null;
  databaseId?: number | null;
  name?: string;
  conclusion?: string | null;
  detailsUrl?: string | null;
  checkSuite?: { app: { slug: string } | null } | null;
}

interface RawResponse {
  repository: {
    pullRequest: {
      commits: {
        nodes: {
          commit: {
            statusCheckRollup: { contexts: { nodes: RawContext[] } } | null;
          };
        }[];
      };
    } | null;
  } | null;
}

const isFailing = (context: RawContext): boolean =>
  ['FAILURE', 'ERROR'].includes(context.conclusion ?? context.state ?? '');

const isRollupParent = (context: RawContext, all: RawContext[]): boolean =>
  all.some((other) => other !== context && (other.name ?? '').startsWith(`${context.name} (`));

export const fetchFailingChecks = async (
  owner: string,
  repo: string,
  number: number,
): Promise<ChecksReport> => {
  const data = await githubGraphql<RawResponse>(query, { owner, repo, number });
  const rollup = data.repository?.pullRequest?.commits.nodes[0]?.commit.statusCheckRollup;
  const contexts = rollup?.contexts.nodes ?? [];
  const failing = contexts.filter(isFailing);

  const interesting = failing.filter((context) => !isRollupParent(context, failing));
  const seenBuilds = new Map<string, Awaited<ReturnType<typeof fetchBuildFailure>> | null>();
  let adoError: string | null = null;

  const checks: FailingCheck[] = [];

  for (const context of interesting) {
    const detailsUrl = context.detailsUrl ?? context.targetUrl ?? null;
    const buildRef = parseBuildUrl(detailsUrl);
    let build = null;

    if (buildRef) {
      const key = `${buildRef.organization}/${buildRef.project}/${buildRef.buildId}`;
      if (seenBuilds.has(key)) {
        build = seenBuilds.get(key) ?? null;
      } else {
        try {
          build = await fetchBuildFailure(buildRef);
        } catch (error) {
          build = null;
          if (error instanceof AzureDevOpsUnavailableError) adoError = error.message;
          else if (!adoError && error instanceof Error) adoError = error.message;
        }
        seenBuilds.set(key, build);
      }
    }

    checks.push({
      name: context.name ?? context.context ?? 'check',
      checkRunId: context.databaseId ?? null,
      detailsUrl,
      isRerunnableOnGithub: context.__typename === 'CheckRun' && typeof context.databaseId === 'number',
      build,
    });
  }

  return { repository: `${owner}/${repo}`, number, checks, adoError };
};

export const rerequestCheckRun = async (
  owner: string,
  repo: string,
  checkRunId: number,
): Promise<void> => {
  await githubRest(`/repos/${owner}/${repo}/check-runs/${checkRunId}/rerequest`, { method: 'POST' });
};
