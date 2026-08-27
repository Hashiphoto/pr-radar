import { readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ServiceInfo } from '../shared/types.js';
import { configFilePath } from './store.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const readVersion = (): string => {
  try {
    const manifest = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')) as {
      version?: string;
    };
    return manifest.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
};

const version = readVersion();

export const unitName = 'pr-radar';

// INVOCATION_ID and JOURNAL_STREAM leak in from any systemd-parented shell, so the
// cgroup is the only signal that distinguishes our unit from a hand-started process.
const isRunningAsUnit = (): boolean => {
  try {
    return readFileSync('/proc/self/cgroup', 'utf8').includes(`${unitName}.service`);
  } catch {
    return false;
  }
};

export const describeService = (port: number, exposedUrls: string[] = []): ServiceInfo => {
  const isSystemd = isRunningAsUnit();

  return {
    name: unitName,
    version,
    pid: process.pid,
    port,
    host: hostname(),
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    managedBy: isSystemd ? 'systemd' : 'manual',
    unit: `${unitName}.service`,
    projectRoot,
    configFile: configFilePath,
    nodeVersion: process.version,
    exposedUrls,
  };
};
