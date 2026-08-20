import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const readGhCliToken = async (): Promise<string | null> => {
  try {
    const { stdout } = await execFileAsync('gh', ['auth', 'token'], { timeout: 10_000 });
    const token = stdout.trim();
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
};

let cached: string | null = null;

export const resolveGithubToken = async (): Promise<string> => {
  if (cached) return cached;

  const fromEnv = process.env.PR_RADAR_TOKEN ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const token = fromEnv?.trim() || (await readGhCliToken());

  if (!token) {
    throw new Error(
      'No GitHub token found. Run `gh auth login`, or set PR_RADAR_TOKEN to a personal access token with `repo` and `read:org` scopes.',
    );
  }

  cached = token;
  return token;
};

export const clearTokenCache = () => {
  cached = null;
};
