import express from 'express';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Settings } from '../shared/types.js';
import { AzureDevOpsUnavailableError, retryBuild } from './azureDevops.js';
import { fetchFailingChecks, rerequestCheckRun } from './checks.js';
import { postComment } from './comments.js';
import { demoChecks, demoService, demoSnapshot, isDemoMode } from './demoData.js';
import { collectLiveIds, fetchSnapshot } from './github.js';
import { describeService } from './serviceInfo.js';
import {
  azureSegment,
  digits,
  githubSlug,
  InvalidInputError,
  optionalSegment,
  positiveInteger,
} from './validate.js';
import {
  addDismissed,
  getDismissed,
  getSettings,
  pruneDismissed,
  removeDismissed,
  resetSettings,
  saveSettings,
  configFilePath,
} from './store.js';

const flags = process.argv.slice(2);

const isTruthy = (value: string | undefined): boolean =>
  value !== undefined && ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());

// --host=1.2.3.4 and --host 1.2.3.4 both read, since a flag typed the other way is a silent
// fallback to loopback rather than an error anybody notices.
const flagValue = (name: string): string | null => {
  const inline = flags.find((flag) => flag.startsWith(`--${name}=`));
  if (inline !== undefined) return inline.slice(name.length + 3);

  const index = flags.indexOf(`--${name}`);
  if (index < 0) return null;

  const next = flags[index + 1];
  return next !== undefined && !next.startsWith('-') ? next : null;
};

const port = Number(flagValue('port') ?? process.env.PORT ?? 4317);
// Loopback unless asked otherwise: the dashboard shows the viewer's private pull requests and can
// trigger authenticated CI writes, and it has no login, so reaching it from another machine has to
// be a decision somebody made rather than what happens by default.
const wantsLan = flags.includes('--lan') || isTruthy(process.env.PR_RADAR_LAN);
const host = flagValue('host') ?? process.env.HOST ?? (wantsLan ? '0.0.0.0' : '127.0.0.1');
const isLoopback = ['127.0.0.1', 'localhost', '::1'].includes(host);

// 0.0.0.0 answers on every interface, so the useful thing to report is the addresses another
// device can actually type. The interface name comes along because a docker bridge and the wifi
// card are both "not internal", and only one of them is the one you want on your phone.
const reachableAt = (): { url: string; interfaceName: string }[] => {
  if (isLoopback) return [];
  if (host !== '0.0.0.0') return [{ url: `http://${host}:${port}`, interfaceName: 'bound address' }];

  return Object.entries(networkInterfaces()).flatMap(([interfaceName, entries]) =>
    (entries ?? [])
      .filter((entry) => entry.family === 'IPv4' && !entry.internal)
      .map((entry) => ({ url: `http://${entry.address}:${port}`, interfaceName })),
  );
};

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const clientDist = join(projectRoot, 'dist');

const app = express();
app.use(express.json());

const asMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unexpected server error';

const failureStatus = (error: unknown): number => {
  if (error instanceof InvalidInputError) return 400;
  if (error instanceof AzureDevOpsUnavailableError) return 401;
  return 502;
};

app.get('/api/prs', async (_request, response) => {
  try {
    const settings = await getSettings();

    if (isDemoMode) {
      response.json(demoSnapshot(settings.vips));
      return;
    }

    const dismissed = await getDismissed();
    const snapshot = await fetchSnapshot(settings, new Set(dismissed.map((entry) => entry.id)));
    await pruneDismissed(collectLiveIds(snapshot));
    response.json(snapshot);
  } catch (error) {
    response.status(502).json({ error: asMessage(error) });
  }
});

app.get('/api/checks', async (request, response) => {
  try {
    const owner = githubSlug('owner', request.query.owner);
    const repo = githubSlug('repo', request.query.repo);
    const number = positiveInteger('number', request.query.number);

    response.json(
      isDemoMode ? demoChecks(`${owner}/${repo}`, number) : await fetchFailingChecks(owner, repo, number),
    );
  } catch (error) {
    response.status(failureStatus(error)).json({ error: asMessage(error) });
  }
});

app.post('/api/retry', async (request, response) => {
  const { organization, project, buildId, stage, owner, repo, checkRunId } = request.body ?? {};

  try {
    if (organization !== undefined || project !== undefined || buildId !== undefined) {
      const message = await retryBuild(
        {
          organization: azureSegment('organization', organization),
          project: azureSegment('project', project),
          buildId: digits('buildId', buildId),
        },
        optionalSegment('stage', stage ?? null),
      );
      response.json({ message });
      return;
    }

    if (checkRunId !== undefined) {
      await rerequestCheckRun(
        githubSlug('owner', owner),
        githubSlug('repo', repo),
        positiveInteger('checkRunId', checkRunId),
      );
      response.json({ message: 'Asked GitHub to re-run the check.' });
      return;
    }

    response.status(400).json({ error: 'Provide an Azure DevOps build or a GitHub check run' });
  } catch (error) {
    response.status(failureStatus(error)).json({ error: asMessage(error) });
  }
});

// The comment body is whatever the viewer configured, so it is read from settings rather than
// taken from the request: a page cannot talk this endpoint into posting something else.
app.post('/api/bot-review', async (request, response) => {
  try {
    const owner = githubSlug('owner', request.body?.owner);
    const repo = githubSlug('repo', request.body?.repo);
    const number = positiveInteger('number', request.body?.number);
    const { botReviewComment } = await getSettings();

    if (botReviewComment.length === 0) {
      response.status(400).json({ error: 'No bot review comment is configured' });
      return;
    }

    if (!isDemoMode) await postComment(owner, repo, number, botReviewComment);
    response.json({ message: `Commented on ${owner}/${repo} #${number}` });
  } catch (error) {
    response.status(failureStatus(error)).json({ error: asMessage(error) });
  }
});

app.get('/api/service', (_request, response) => {
  response.json(
    isDemoMode
      ? demoService(port)
      : describeService(port, reachableAt().map((entry) => entry.url)),
  );
});

app.get('/api/settings', async (_request, response) => {
  response.json({
    settings: await getSettings(),
    configFile: isDemoMode ? demoService(port).configFile : configFilePath,
  });
});

app.put('/api/settings', async (request, response) => {
  try {
    response.json({ settings: await saveSettings(request.body as Partial<Settings>) });
  } catch (error) {
    response.status(400).json({ error: asMessage(error) });
  }
});

app.post('/api/settings/reset', async (_request, response) => {
  try {
    response.json({ settings: await resetSettings() });
  } catch (error) {
    response.status(500).json({ error: asMessage(error) });
  }
});

app.get('/api/dismissed', async (_request, response) => {
  response.json({ dismissed: await getDismissed() });
});

app.post('/api/dismissed', async (request, response) => {
  const { id, url, title, repository, number } = request.body ?? {};

  if (typeof id !== 'string' || id.length === 0) {
    response.status(400).json({ error: 'A pull request id is required' });
    return;
  }

  response.json({
    dismissed: await addDismissed({
      id,
      url: typeof url === 'string' ? url : '',
      title: typeof title === 'string' ? title : '',
      repository: typeof repository === 'string' ? repository : '',
      number: typeof number === 'number' ? number : 0,
    }),
  });
});

app.delete('/api/dismissed/:id', async (request, response) => {
  response.json({ dismissed: await removeDismissed(request.params.id) });
});

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api\/).*/, (_request, response) => {
    response.sendFile(join(clientDist, 'index.html'));
  });
}

app.listen(port, host, () => {
  const hasClient = existsSync(clientDist);
  const addresses = reachableAt();

  console.log(`pr-radar listening on http://localhost:${port}`);

  if (addresses.length > 0) {
    console.log('reachable from your local network at:');
    for (const { url, interfaceName } of addresses) console.log(`  ${url}  (${interfaceName})`);
    console.log(
      'PR Radar has no login, so anyone who can reach that port reads your pull requests and can',
    );
    console.log('retry your builds. Keep it to networks you trust.');
  } else if (!isLoopback) {
    console.log(`bound to ${host}, but no network address was found to report`);
  }

  console.log(`config file: ${configFilePath}`);
  if (!hasClient) {
    console.log('client bundle not built yet - run `pnpm dev` for the Vite dev server');
  }
});
