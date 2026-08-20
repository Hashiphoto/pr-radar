const timestampPattern = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s?/;
const ansiPattern = /\x1b\[[0-9;]*m/g;
const turboPrefixPattern = /^[a-z0-9@/._-]+:[a-z0-9:_-]+:\s?/i;
const adoDirectivePattern = /^##\[(section|group|endgroup|command|debug|warning)\]/;

const maxLines = 22;
const maxLineLength = 200;

const clean = (line: string): string =>
  line.replace(timestampPattern, '').replace(ansiPattern, '').trimEnd();

const withoutPackagePrefix = (line: string): string => line.replace(turboPrefixPattern, '');

const truncate = (line: string): string =>
  line.length > maxLineLength ? `${line.slice(0, maxLineLength - 1)}…` : line;

const isNoise = (line: string): boolean =>
  line.trim().length === 0 ||
  adoDirectivePattern.test(line) ||
  /^={10,}$/.test(line.trim()) ||
  /^(Task|Description|Version|Author|Help)\s+:/.test(line);

const dedupe = (lines: string[]): string[] => [...new Set(lines)];

const jestFailures = (lines: string[]): string[] => {
  const summaryIndex = lines.findLastIndex((line) => /Summary of all failing tests/.test(line));
  const scope = summaryIndex >= 0 ? lines.slice(summaryIndex + 1) : lines;

  const failures = dedupe(
    scope
      .map(withoutPackagePrefix)
      .filter((line) => /^\s*(FAIL\s|●\s)/.test(line))
      .filter((line) => !/●\s+Console\s*$/.test(line)),
  );

  if (failures.length === 0) return [];

  const totals = dedupe(
    lines
      .map(withoutPackagePrefix)
      .filter((line) => /^\s*(Tests|Test Suites):\s.*\d+ failed/.test(line)),
  );

  return [...failures, ...totals];
};

const typescriptErrors = (lines: string[]): string[] =>
  dedupe(lines.map(withoutPackagePrefix).filter((line) => /error TS\d+:/.test(line)));

const mavenFailures = (lines: string[]): string[] =>
  dedupe(
    lines
      .map(withoutPackagePrefix)
      .filter((line) =>
        /^\s*\[ERROR\]\s+\S+\.\S+(\s|:)|Tests run:.*(Failures|Errors): [1-9]/.test(line),
      ),
  );

const explicitErrors = (lines: string[]): string[] =>
  dedupe(
    lines
      .map((line) => withoutPackagePrefix(line).trim())
      .filter(
        (line) =>
          /^##\[error\]/.test(line) ||
          /^(ERROR|Error|error)[:\s]/.test(line) ||
          /^npm ERR!/.test(line) ||
          /^Caused by:/.test(line),
      )
      .map((line) => line.replace(/^##\[error\]/, '')),
  );

const tailFallback = (lines: string[]): string[] =>
  lines.filter((line) => !isNoise(line)).slice(-12).map(withoutPackagePrefix);

const strategies = [jestFailures, typescriptErrors, mavenFailures, explicitErrors];

export const extractErrorLines = (rawLog: string): string[] => {
  const lines = rawLog.split('\n').map(clean);

  const matched = strategies.reduce<string[]>(
    (found, strategy) => (found.length > 0 ? found : strategy(lines)),
    [],
  );
  const candidates = matched.length > 0 ? matched : tailFallback(lines);

  return candidates
    .map((line) => truncate(line.trim()))
    .filter((line) => line.length > 0)
    .slice(0, maxLines);
};
