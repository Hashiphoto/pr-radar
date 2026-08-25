import type { AccessBlock } from '../shared/types.js';
import { githubRestHeaders } from './githubClient.js';

const ssoHeader = 'x-github-sso';

// A listing that spans organizations is what makes GitHub name the ones it left out.
const listingPath = '/user/repos?per_page=1';

const firstCapture = (value: string | null, pattern: RegExp): string | null =>
  (value?.match(pattern)?.[1] ?? null) || null;

const withheldOrganizationIds = (header: string | null): string[] =>
  firstCapture(header, /organizations=([\d,]+)/)?.split(',').filter(Boolean) ?? [];

// An opaque per-request grant, stated nowhere but the refusal, so it has to be asked for.
const authorizationUrlFor = async (organizationId: string): Promise<string | null> => {
  const refusal = await githubRestHeaders(`/organizations/${organizationId}`);
  return firstCapture(refusal.headers.get(ssoHeader), /url=(\S+)/);
};

// The organization is invisible to a token it has not been authorized for, so its own name has to
// come out of the url that authorizes it.
const nameFrom = (authorizationUrl: string | null): string | null =>
  firstCapture(authorizationUrl, /github\.com\/(?:enterprises|orgs)\/([^/]+)\/sso/);

export const detectAccessBlock = async (): Promise<AccessBlock | null> => {
  const listing = await githubRestHeaders(listingPath);
  const organizationIds = withheldOrganizationIds(listing.headers.get(ssoHeader));
  const [firstOrganizationId] = organizationIds;

  if (!firstOrganizationId) return null;

  const authorizationUrl = await authorizationUrlFor(firstOrganizationId);

  return { name: nameFrom(authorizationUrl), organizationIds, authorizationUrl };
};
