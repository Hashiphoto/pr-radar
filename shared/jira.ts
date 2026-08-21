// Prefixes that look like a Jira key in a title but never are.
const notProjectKeys = new Set(['UTF', 'HTTP', 'HTTPS', 'SHA', 'MD', 'AES', 'RSA', 'RFC', 'ISO', 'IPV', 'UTC', 'EC', 'S', 'H', 'CVE']);

const keyPattern = /\b([A-Z][A-Z0-9]{1,9})-(\d{1,6})\b/g;

export const jiraKeyFromTitle = (title: string): string | null => {
  for (const match of title.matchAll(keyPattern)) {
    if (!notProjectKeys.has(match[1] ?? '')) return match[0];
  }
  return null;
};

export const jiraUrl = (baseUrl: string, key: string): string =>
  `${baseUrl.replace(/\/+$/, '')}/${key}`;
