import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { BuildFailure, FailedTask } from '../shared/types.js';
import { extractErrorLines } from './logDigest.js';

const execFileAsync = promisify(execFile);

const adoResourceId = '499b84ac-1321-427f-aa17-267ca6975798';
const apiVersion = '7.1';
const maxTasksInspected = 4;

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

export class AzureDevOpsUnavailableError extends Error {}

const acquireToken = async (): Promise<string> => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  if (process.env.AZURE_DEVOPS_PAT) {
    return Buffer.from(`:${process.env.AZURE_DEVOPS_PAT}`).toString('base64');
  }

  try {
    const { stdout } = await execFileAsync(
      'az',
      ['account', 'get-access-token', '--resource', adoResourceId, '-o', 'json'],
      { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
    );
    const parsed = JSON.parse(stdout) as { accessToken: string; expires_on?: number };
    cachedToken = {
      token: parsed.accessToken,
      expiresAt: parsed.expires_on ? parsed.expires_on * 1000 : Date.now() + 45 * 60_000,
    };
    return cachedToken.token;
  } catch {
    throw new AzureDevOpsUnavailableError(
      'Azure DevOps is unreachable. Run `az login`, or set AZURE_DEVOPS_PAT to a personal access token with Build (read and execute).',
    );
  }
};

const authorizationHeader = async (): Promise<string> =>
  process.env.AZURE_DEVOPS_PAT ? `Basic ${await acquireToken()}` : `Bearer ${await acquireToken()}`;

export interface BuildRef {
  organization: string;
  project: string;
  buildId: string;
}

const buildUrlPattern =
  /^https:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_build\/results\?(?:.*&)?buildId=(\d+)/;

export const parseBuildUrl = (detailsUrl: string | null): BuildRef | null => {
  if (!detailsUrl) return null;
  const match = buildUrlPattern.exec(detailsUrl);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  return { organization: match[1], project: match[2], buildId: match[3] };
};

export const buildWebUrl = (ref: BuildRef): string =>
  `https://dev.azure.com/${ref.organization}/${ref.project}/_build/results?buildId=${ref.buildId}&view=results`;

const taskWebUrl = (ref: BuildRef, jobId: string): string =>
  `https://dev.azure.com/${ref.organization}/${ref.project}/_build/results?buildId=${ref.buildId}&view=logs&j=${jobId}`;

const apiUrl = (ref: BuildRef, path: string): string =>
  `https://dev.azure.com/${ref.organization}/${ref.project}/_apis/build/builds/${ref.buildId}${path}?api-version=${apiVersion}`;

const request = async (
  url: string,
  init?: RequestInit,
  accept = 'application/json',
): Promise<Response> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: await authorizationHeader(),
      Accept: accept,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new AzureDevOpsUnavailableError(
      `Azure DevOps denied the request (${response.status}). Your credentials may lack Build permissions on this project.`,
    );
  }

  return response;
};

interface TimelineRecord {
  id: string;
  parentId: string | null;
  type: string;
  name: string;
  identifier: string | null;
  result: string | null;
  state: string | null;
  attempt: number;
  log: { url: string } | null;
  issues: { type: string; message: string }[] | null;
}

const stageOf = (record: TimelineRecord, byId: Map<string, TimelineRecord>): TimelineRecord | null => {
  let current: TimelineRecord | undefined = record;
  while (current) {
    if (current.type === 'Stage') return current;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return null;
};

const asPlainText = (body: string): string => {
  if (!body.startsWith('{')) return body;
  try {
    const parsed = JSON.parse(body) as { value?: string[] };
    return Array.isArray(parsed.value) ? parsed.value.join('\n') : body;
  } catch {
    return body;
  }
};

const fetchLogDigest = async (logUrl: string): Promise<string[]> => {
  try {
    const response = await request(logUrl, undefined, 'text/plain');
    if (!response.ok) return [];
    return extractErrorLines(asPlainText(await response.text()));
  } catch {
    return [];
  }
};

const completedBuilds = new Map<string, BuildFailure>();

export const fetchBuildFailure = async (ref: BuildRef): Promise<BuildFailure> => {
  const cacheKey = `${ref.organization}/${ref.project}/${ref.buildId}`;
  const cached = completedBuilds.get(cacheKey);
  if (cached) return cached;

  const buildResponse = await request(apiUrl(ref, ''));
  if (!buildResponse.ok) {
    throw new Error(`Azure DevOps returned ${buildResponse.status} for build ${ref.buildId}`);
  }

  const build = (await buildResponse.json()) as {
    status: string;
    result: string | null;
    definition: { name: string };
  };

  const timelineResponse = await request(apiUrl(ref, '/timeline'));
  const records: TimelineRecord[] = timelineResponse.ok
    ? ((await timelineResponse.json()) as { records: TimelineRecord[] }).records
    : [];

  const byId = new Map(records.map((record) => [record.id, record]));

  const failedTaskRecords = records.filter(
    (record) => record.type === 'Task' && record.result === 'failed',
  );

  const failedTasks: FailedTask[] = await Promise.all(
    failedTaskRecords.slice(0, maxTasksInspected).map(async (record) => {
      const stage = stageOf(record, byId);
      const issueMessages = (record.issues ?? [])
        .filter((issue) => issue.type?.toLowerCase() === 'error')
        .map((issue) => issue.message);
      const digest = record.log ? await fetchLogDigest(record.log.url) : [];

      return {
        name: record.name,
        stage: stage?.name ?? null,
        errorLines: digest.length > 0 ? digest : issueMessages,
        webUrl: taskWebUrl(ref, record.id),
      };
    }),
  );

  const failedStages = records
    .filter((record) => record.type === 'Stage' && record.result === 'failed' && record.identifier)
    .map((record) => ({ identifier: record.identifier as string, name: record.name }));

  const failure: BuildFailure = {
    organization: ref.organization,
    project: ref.project,
    buildId: ref.buildId,
    definitionName: build.definition.name,
    isComplete: build.status === 'completed',
    webUrl: buildWebUrl(ref),
    failedStages,
    failedTasks,
    truncatedTaskCount: Math.max(0, failedTaskRecords.length - failedTasks.length),
  };

  if (failure.isComplete) completedBuilds.set(cacheKey, failure);

  return failure;
};

export const retryBuild = async (ref: BuildRef, stageIdentifier: string | null): Promise<string> => {
  const url = stageIdentifier
    ? `https://dev.azure.com/${ref.organization}/${ref.project}/_apis/build/builds/${ref.buildId}/stages/${encodeURIComponent(stageIdentifier)}?api-version=${apiVersion}`
    : `${apiUrl(ref, '')}&retry=true`;

  const response = await request(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: stageIdentifier
      ? JSON.stringify({ state: 'retry', forceRetryAllJobs: false })
      : JSON.stringify({}),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Azure DevOps refused the retry (${response.status}). ${detail.slice(0, 240)}`.trim(),
    );
  }

  completedBuilds.delete(`${ref.organization}/${ref.project}/${ref.buildId}`);

  return stageIdentifier
    ? `Retrying the ${stageIdentifier} stage of build ${ref.buildId}.`
    : `Retrying build ${ref.buildId}.`;
};
