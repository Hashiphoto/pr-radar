import type {
  ChecksReport,
  DismissedEntry,
  RetryResult,
  ServiceInfo,
  Settings,
  Snapshot,
} from '../shared/types.js';

const request = async <TResult>(path: string, init?: RequestInit): Promise<TResult> => {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((payload as { error?: string }).error ?? `Request failed (${response.status})`);
  }

  return payload as TResult;
};

export const fetchSnapshot = () => request<Snapshot>('/prs');

export const fetchSettings = () => request<{ settings: Settings; stateFile: string }>('/settings');

export const updateSettings = (patch: Partial<Settings>) =>
  request<{ settings: Settings }>('/settings', { method: 'PUT', body: JSON.stringify(patch) });

export const resetSettings = () =>
  request<{ settings: Settings }>('/settings/reset', { method: 'POST' });

export const dismissPr = (entry: Omit<DismissedEntry, 'dismissedAt'>) =>
  request<{ dismissed: DismissedEntry[] }>('/dismissed', {
    method: 'POST',
    body: JSON.stringify(entry),
  });

export const restorePr = (id: string) =>
  request<{ dismissed: DismissedEntry[] }>(`/dismissed/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

export const fetchFailingChecks = (repository: string, number: number) => {
  const [owner, repo] = repository.split('/');
  const params = new URLSearchParams({ owner: owner ?? '', repo: repo ?? '', number: String(number) });
  return request<ChecksReport>(`/checks?${params.toString()}`);
};

export interface RetryTarget {
  organization?: string;
  project?: string;
  buildId?: string;
  stage?: string | null;
  owner?: string;
  repo?: string;
  checkRunId?: number;
}

export const retryChecks = (target: RetryTarget) =>
  request<RetryResult>('/retry', { method: 'POST', body: JSON.stringify(target) });

export const requestBotReview = (repository: string, number: number) => {
  const [owner, repo] = repository.split('/');
  return request<RetryResult>('/bot-review', {
    method: 'POST',
    body: JSON.stringify({ owner, repo, number }),
  });
};

export const fetchService = () => request<ServiceInfo>('/service');
