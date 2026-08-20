import { useEffect, useState } from 'react';
import type { ServiceInfo } from '../../shared/types.js';
import * as api from '../api.js';

const formatUptime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

interface Command {
  label: string;
  command: string;
}

const commandsFor = (service: ServiceInfo | null): Command[] => {
  const unit = service?.name ?? 'pr-radar';
  const port = service?.port ?? 4317;

  const shared: Command[] = [
    { label: 'Start (and open)', command: './pr-radar' },
    { label: 'Status', command: './pr-radar status' },
    { label: 'Restart', command: './pr-radar restart' },
    { label: 'Follow the log', command: './pr-radar logs' },
    { label: 'Stop', command: './pr-radar stop' },
    { label: 'Rebuild after a code change', command: './pr-radar build' },
    {
      label: 'Health check',
      command: `curl -s ${window.location.host || `localhost:${port}`}/api/service | jq`,
    },
  ];

  if (service?.managedBy === 'systemd') {
    return [
      ...shared,
      { label: 'systemd status', command: `systemctl --user status ${unit}` },
      { label: 'systemd log', command: `journalctl --user -u ${unit} -f` },
      { label: 'Stop starting at login', command: `./pr-radar uninstall` },
    ];
  }

  return [
    ...shared,
    { label: 'Run it as a background service', command: './pr-radar install' },
    ...(service ? [{ label: 'Kill this process', command: `kill ${service.pid}` }] : []),
  ];
};

const CommandRow = ({ entry }: { entry: Command }) => {
  const [isCopied, setIsCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(entry.command);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1400);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <li className="command-row">
      <span className="command-label">{entry.label}</span>
      <code>{entry.command}</code>
      <button type="button" className="copy-button" onClick={() => void copy()} title="Copy">
        {isCopied ? 'copied' : 'copy'}
      </button>
    </li>
  );
};

export const ServiceFooter = () => {
  const [service, setService] = useState<ServiceInfo | null>(null);
  const [isReachable, setIsReachable] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const load = () => {
      api
        .fetchService()
        .then((result) => {
          setService(result);
          setIsReachable(true);
        })
        .catch(() => setIsReachable(false));
    };

    load();
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <footer className="service-footer">
      <button
        type="button"
        className="service-summary"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <span className={`status-dot${isReachable ? ' is-up' : ' is-down'}`} />
        <strong>{service?.name ?? 'pr-radar'}</strong>
        <span className="service-facts">
          {isReachable ? 'running' : 'unreachable'}
          {service && (
            <>
              {' · '}
              {service.managedBy === 'systemd' ? `systemd (${service.unit})` : 'started by hand'}
              {' · pid '}
              {service.pid}
              {' · up '}
              {formatUptime(service.uptimeSeconds)}
              {' · port '}
              {service.port}
              {' · v'}
              {service.version}
            </>
          )}
        </span>
        <span className="service-toggle">{isOpen ? 'hide commands' : 'manage'}</span>
      </button>

      {isOpen && (
        <div className="service-detail">
          {service && (
            <dl className="service-grid">
              <dt>Project</dt>
              <dd><code>{service.projectRoot}</code></dd>
              <dt>State file</dt>
              <dd><code>{service.stateFile}</code></dd>
              <dt>Started</dt>
              <dd>{new Date(service.startedAt).toLocaleString()}</dd>
              <dt>Node</dt>
              <dd>{service.nodeVersion} on {service.host}</dd>
            </dl>
          )}

          {service?.managedBy === 'manual' && (
            <p className="hint">
              This instance was started by hand, so it will not come back after a reboot. Run{' '}
              <code>./pr-radar install</code> to keep it running as a systemd user service.
            </p>
          )}

          <p className="field-label">Commands</p>
          <p className="hint">
            Run from <code>{service?.projectRoot ?? 'the project root'}</code>
          </p>
          <ul className="command-list">
            {commandsFor(service).map((entry) => (
              <CommandRow key={entry.command} entry={entry} />
            ))}
          </ul>
        </div>
      )}
    </footer>
  );
};
