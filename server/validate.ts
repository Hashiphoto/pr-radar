export class InvalidInputError extends Error {}

const reject = (field: string, value: unknown): never => {
  throw new InvalidInputError(`${field} is not valid: ${String(value).slice(0, 60)}`);
};

// These values are interpolated into GitHub and Azure DevOps URLs, so anything that could
// escape its path segment has to be refused rather than escaped and hoped for.
const isTraversal = (value: string): boolean =>
  value === '.' || value === '..' || /[/\\?#]/.test(value);

export const githubSlug = (field: string, value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 100) reject(field, value);
  const slug = value as string;
  if (!/^[A-Za-z0-9._-]+$/.test(slug) || isTraversal(slug)) reject(field, slug);
  return slug;
};

export const azureSegment = (field: string, value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 200) reject(field, value);
  const segment = value as string;
  if (isTraversal(segment)) reject(field, segment);
  return segment;
};

export const positiveInteger = (field: string, value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) reject(field, value);
  return parsed;
};

export const digits = (field: string, value: unknown): string => {
  if (typeof value !== 'string' || !/^\d{1,18}$/.test(value)) reject(field, value);
  return value as string;
};

export const optionalSegment = (field: string, value: unknown): string | null =>
  value === null || value === undefined ? null : azureSegment(field, value);
