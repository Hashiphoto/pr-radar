import { useEffect, useState } from 'react';
import type { BuildFailure, ChecksReport, FailingCheck } from '../../shared/types.js';
import * as api from '../api.js';
import type { RetryTarget } from '../api.js';

type RetryState = { status: 'idle' | 'confirming' | 'running' | 'done' | 'failed'; message?: string };

const retryLabel = (build: BuildFailure): string => {
  const [stage] = build.failedStages;
  if (build.failedStages.length === 1 && stage && stage.identifier !== '__default') {
    return `Retry the ${stage.name} stage`;
  }
  return 'Retry the failed jobs';
};

const retryTargetFor = (check: FailingCheck, repository: string, number: number): RetryTarget | null => {
  if (check.build) {
    const [stage] = check.build.failedStages;
    return {
      organization: check.build.organization,
      project: check.build.project,
      buildId: check.build.buildId,
      stage: check.build.failedStages.length === 1 && stage ? stage.identifier : null,
    };
  }

  if (check.isRerunnableOnGithub && check.checkRunId !== null) {
    const [owner, repo] = repository.split('/');
    return { owner, repo, checkRunId: check.checkRunId };
  }

  void number;
  return null;
};

interface CheckBlockProps {
  check: FailingCheck;
  repository: string;
  number: number;
}

const CheckBlock = ({ check, repository, number }: CheckBlockProps) => {
  const [retry, setRetry] = useState<RetryState>({ status: 'idle' });
  const target = retryTargetFor(check, repository, number);

  const run = async () => {
    if (!target) return;
    setRetry({ status: 'running' });
    try {
      const result = await api.retryChecks(target);
      setRetry({ status: 'done', message: result.message });
    } catch (error) {
      setRetry({
        status: 'failed',
        message: error instanceof Error ? error.message : 'Retry failed',
      });
    }
  };

  return (
    <div className="check-block">
      <div className="check-block-head">
        <span className="check-name">{check.name}</span>
        {check.build && <span className="check-build">build {check.build.buildId}</span>}
        <div className="topbar-spacer" />
        {check.detailsUrl && (
          <a className="check-link" href={check.detailsUrl} target="_blank" rel="noreferrer">
            Open in Azure ↗
          </a>
        )}
      </div>

      {check.build?.failedTasks.map((task) => (
        <div className="failed-task" key={`${task.name}-${task.webUrl}`}>
          <div className="failed-task-head">
            <span>{task.name}</span>
            {task.stage && <span className="check-build">{task.stage}</span>}
            <div className="topbar-spacer" />
            <a className="check-link" href={task.webUrl} target="_blank" rel="noreferrer">
              logs ↗
            </a>
          </div>
          {task.errorLines.length > 0 ? (
            <pre className="error-log">{task.errorLines.join('\n')}</pre>
          ) : (
            <p className="hint">No error lines could be extracted. Open the logs in Azure.</p>
          )}
        </div>
      ))}

      {check.build && check.build.truncatedTaskCount > 0 && (
        <p className="hint">
          {check.build.truncatedTaskCount} more failed task
          {check.build.truncatedTaskCount === 1 ? '' : 's'} not shown.
        </p>
      )}

      {check.build && check.build.failedTasks.length === 0 && (
        <p className="hint">
          Azure DevOps reported no failing task for this build. It may still be running, or the
          failure happened before any task started.
        </p>
      )}

      {target && (
        <div className="retry-row">
          {retry.status === 'idle' && (
            <button
              type="button"
              className="retry-button"
              onClick={() => setRetry({ status: 'confirming' })}
            >
              {check.build ? retryLabel(check.build) : 'Ask GitHub to re-run'}
            </button>
          )}
          {retry.status === 'confirming' && (
            <>
              <span className="hint">This queues real CI work. Continue?</span>
              <button type="button" className="retry-button is-confirm" onClick={() => void run()}>
                Yes, retry
              </button>
              <button
                type="button"
                className="retry-button"
                onClick={() => setRetry({ status: 'idle' })}
              >
                Cancel
              </button>
            </>
          )}
          {retry.status === 'running' && <span className="hint">Queueing…</span>}
          {retry.status === 'done' && <span className="retry-ok">{retry.message}</span>}
          {retry.status === 'failed' && <span className="retry-bad">{retry.message}</span>}
        </div>
      )}
    </div>
  );
};

export interface ChecksPanelProps {
  repository: string;
  number: number;
}

export const ChecksPanel = ({ repository, number }: ChecksPanelProps) => {
  const [report, setReport] = useState<ChecksReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    api
      .fetchFailingChecks(repository, number)
      .then((result) => {
        if (isCurrent) setReport(result);
      })
      .catch((caught: unknown) => {
        if (isCurrent) setError(caught instanceof Error ? caught.message : 'Could not load checks');
      });

    return () => {
      isCurrent = false;
    };
  }, [number, repository]);

  if (error) return <div className="checks-panel"><p className="retry-bad">{error}</p></div>;
  if (!report) return <div className="checks-panel"><p className="hint">Loading failures…</p></div>;

  return (
    <div className="checks-panel">
      {report.adoError && <p className="retry-bad">{report.adoError}</p>}
      {report.checks.length === 0 && (
        <p className="hint">No failing checks are reported on the latest commit any more.</p>
      )}
      {report.checks.map((check, index) => (
        <CheckBlock
          key={`${check.name}-${check.checkRunId ?? index}`}
          check={check}
          repository={repository}
          number={number}
        />
      ))}
    </div>
  );
};
