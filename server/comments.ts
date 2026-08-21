import { githubRest } from './githubClient.js';

export const postComment = async (
  owner: string,
  repo: string,
  number: number,
  body: string,
): Promise<void> => {
  await githubRest(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}/comments`,
    { method: 'POST', body: JSON.stringify({ body }) },
  );
};
