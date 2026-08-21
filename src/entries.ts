import type { ColumnValues } from '../shared/columns.js';
import type { PullRequest } from '../shared/types.js';

// A pull request paired with the column values it resolved to: the table renders them and the
// group filters match on them, so they are derived once per refresh rather than per group.
export interface PrEntry {
  pullRequest: PullRequest;
  values: ColumnValues;
}
