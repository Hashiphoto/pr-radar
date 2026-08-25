import { resolveGithubToken } from './token.js';

const graphqlEndpoint = 'https://api.github.com/graphql';
const restEndpoint = 'https://api.github.com';

const describeHttpFailure = (response: Response): string => {
  if (response.status === 401) {
    return 'GitHub rejected the token (401). Run `gh auth login`, or set PR_RADAR_TOKEN to a token with the `repo` and `read:org` scopes.';
  }
  if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
    return 'GitHub rate limit exhausted (403). Try again after the limit resets.';
  }
  if (response.status === 403) {
    return 'GitHub denied the request (403). The token is likely missing a scope, or SAML SSO has not been authorized for this organization.';
  }
  return `GitHub API returned ${response.status} ${response.statusText}`;
};

const headers = async (): Promise<Record<string, string>> => ({
  Authorization: `Bearer ${await resolveGithubToken()}`,
  'Content-Type': 'application/json',
  Accept: 'application/vnd.github+json',
  'User-Agent': 'pr-radar',
});

export interface GraphqlResult<TData> {
  data: TData;
  warnings: string[];
}

export const githubGraphqlWithWarnings = async <TData,>(
  query: string,
  variables: Record<string, unknown>,
): Promise<GraphqlResult<TData>> => {
  const response = await fetch(graphqlEndpoint, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) throw new Error(describeHttpFailure(response));

  const payload = (await response.json()) as {
    data?: TData;
    errors?: { message: string }[];
  };
  const warnings = (payload.errors ?? []).map((error) => error.message);

  if (!payload.data) throw new Error(warnings.join('; ') || 'GitHub API returned no data');

  return { data: payload.data, warnings };
};

export const githubGraphql = async <TData,>(
  query: string,
  variables: Record<string, unknown>,
): Promise<TData> => (await githubGraphqlWithWarnings<TData>(query, variables)).data;

// Status and headers of a GET, without the throw: a refusal is the answer here rather than a
// failure, since what SAML SSO withheld is stated in a header on the way past.
export const githubRestHeaders = async (path: string): Promise<{ status: number; headers: Headers }> => {
  const response = await fetch(`${restEndpoint}${path}`, { headers: await headers() });
  return { status: response.status, headers: response.headers };
};

export const githubRest = async (path: string, init?: RequestInit): Promise<unknown> => {
  const response = await fetch(`${restEndpoint}${path}`, { ...init, headers: await headers() });

  if (!response.ok) throw new Error(describeHttpFailure(response));

  const body = await response.text();
  return body.length > 0 ? JSON.parse(body) : null;
};
