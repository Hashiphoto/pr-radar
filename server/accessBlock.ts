import type { AccessBlock } from '../shared/types.js';
import { githubRestProbe } from './githubClient.js';

const ssoHeader = 'x-github-sso';

// A listing that spans organizations is what makes GitHub name the ones it left out.
const listingPath = '/user/repos?per_page=1';

const firstCapture = (value: string | null, pattern: RegExp): string | null =>
  (value?.match(pattern)?.[1] ?? null) || null;

const withheldOrganizationIds = (header: string | null): string[] =>
  firstCapture(header, /organizations=([\d,]+)/)?.split(',').filter(Boolean) ?? [];

const messageFrom = (body: unknown): string | null => {
  const message = (body as { message?: unknown })?.message;
  return typeof message === 'string' && message.length > 0 ? message : null;
};

export const detectAccessBlock = async (): Promise<AccessBlock | null> => {
  const listing = await githubRestProbe(listingPath);
  const [firstOrganizationId] = withheldOrganizationIds(listing.headers.get(ssoHeader));

  if (!firstOrganizationId) return null;

  // Asking after one of them is refused in GitHub's own words, with the url that clears it.
  const refusal = await githubRestProbe(`/organizations/${firstOrganizationId}`);

  return {
    status: refusal.status,
    message: messageFrom(refusal.body) ?? 'GitHub is withholding this organization from the token.',
    authorizationUrl: firstCapture(refusal.headers.get(ssoHeader), /url=(\S+)/),
  };
};
