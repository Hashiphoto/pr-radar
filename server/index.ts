import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Settings } from '../shared/types.js';
import { AzureDevOpsUnavailableError, retryBuild } from './azureDevops.js';
import { fetchFailingChecks, rerequestCheckRun } from './checks.js';
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
  saveSettings,
  stateFilePath,
} from './store.js';

const port = Number(process.env.PORT ?? 4317);
// Loopback only by default: the dashboard exposes the viewer's private pull requests and
// can trigger authenticated CI writes, so it must not be reachable from the network.
const host = process.env.HOST ?? '127.0.0.1';
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

app.get('/api/service', (_request, response) => {
  response.json(isDemoMode ? demoService(port) : describeService(port));
});

app.get('/api/settings', async (_request, response) => {
  response.json({
    settings: await getSettings(),
    stateFile: isDemoMode ? demoService(port).stateFile : stateFilePath,
  });
});

app.put('/api/settings', async (request, response) => {
  try {
    response.json({ settings: await saveSettings(request.body as Partial<Settings>) });
  } catch (error) {
    response.status(400).json({ error: asMessage(error) });
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
  console.log(`pr-radar listening on http://${host === '127.0.0.1' ? 'localhost' : host}:${port}`);
  console.log(`state file: ${stateFilePath}`);
  if (!hasClient) {
    console.log('client bundle not built yet - run `pnpm dev` for the Vite dev server');
  }
});
