# PR Radar

A personalized GitHub pull request dashboard that runs locally. It answers one
question on one screen: **what actually needs me right now?**

- **VIP review requests** — a dedicated section at the top for people you care about most.
- **Review requested** — everything else waiting on your review, oldest first.
- **My pull requests** — your own PRs grouped by state: changes requested, awaiting review, approved, draft.
- **Not going to review** — set a PR aside and it leaves the queue, recoverable at any time.
- **Failing checks, explained inline** — click a `checks failed` badge to see the actual failing
  tests pulled from the Azure DevOps logs, jump to the build, or retry just the failed stage.

![PR Radar](docs/screenshot-light.png)

<sub>Every screenshot on this page is generated from the built-in demo dataset, not from real pull requests.</sub>

Data comes straight from the GitHub GraphQL API. One request per refresh, so a
2-minute poll costs about 30 of your 5,000 hourly points.

## Quick start

```bash
cd ~/Git/pr-radar
pnpm install
pnpm build
./pr-radar          # starts the server and opens a browser
```

Or run it in development, with hot reload on both halves:

```bash
pnpm dev            # client on :3117, api on :4317
```

## Triaging a failing build

Click the red `checks failed` badge on any card. PR Radar reads the Azure Pipelines check
runs on the head commit, then for each failing build pulls the ADO timeline and the failing
task logs, and extracts the part you actually want:

```
Web CI                                                   build 48213   Open in Azure ↗
Test web client                                                               logs ↗
  FAIL src/app/components/dataGrid/tests/PagedGrid.unit.test.tsx
  ● PagedGrid › loadPage › discards a stale reset()-raced response
  Tests: 4 failed, 15 skipped, 14301 passed, 14320 total
  [ Retry the WebProjects stage ]
```

Digest extraction understands jest summaries, `error TS####` lines, Maven/surefire
failures, and `##[error]` annotations, falling back to the tail of the log. Completed
builds are cached, so re-opening a panel is free.

**Retry** uses the ADO stage-retry API when exactly one stage failed, so only the failed
jobs re-run rather than the whole pipeline. Checks that are not Azure Pipelines fall back
to asking GitHub to re-run the check run. Every retry asks for confirmation first, because
it queues real CI work.

### Azure DevOps access

Read and retry both use your existing `az` login — no PAT required:

```bash
az login          # once; the token is fetched per session and cached
```

Set `AZURE_DEVOPS_PAT` instead if you would rather use a personal access token with
**Build (read and execute)**. Without either, the panel still lists the failing checks
and links to Azure; it just cannot show the log digest or retry.

## Authentication

PR Radar looks for a token in this order:

1. `PR_RADAR_TOKEN`
2. `GITHUB_TOKEN`
3. `GH_TOKEN`
4. `gh auth token` — the GitHub CLI's token

If you already use the `gh` CLI, there is nothing to configure. Otherwise create
a personal access token with the **`repo`** and **`read:org`** scopes and export
it as `PR_RADAR_TOKEN`. For organizations behind SAML SSO, authorize the token
for that org or its PRs will be missing.

## Settings

Open the drawer with the gear icon or <kbd>,</kbd>.

| Setting | What it does |
| --- | --- |
| **VIP authors** | Review requests from these logins get their own section pinned to the top. Paste several at once, separated by spaces or commas. You can also click the ☆ on any card to promote or demote its author. |
| **Limit to organizations** | Restrict the search to specific orgs. Empty means every repository you can see. |
| **Include team review requests** | On: show PRs requested from a team you belong to. Off: only requests addressed to you by name. |
| **Ignore bot reviews** | Keeps CodeRabbit, Unblocked, and friends out of the approval counts. |
| **Auto refresh** | How often to poll GitHub. Default is every 2 minutes. |

![Settings drawer in dark mode](docs/screenshot-dark.png)

Settings and dismissals persist to `~/.config/pr-radar/state.json`. Override the
location with `PR_RADAR_STATE`.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| <kbd>r</kbd> | Refresh now |
| <kbd>/</kbd> | Focus the filter box |
| <kbd>d</kbd> | Toggle the "not reviewing" section |
| <kbd>,</kbd> | Open settings |
| <kbd>Esc</kbd> | Close settings, or blur the filter box |

## What each badge means

| Badge | Meaning |
| --- | --- |
| `waiting 6d` | How long a review request has been open. Amber past 2 days, red past 7. |
| `checks pass` / `checks failed` / `checks running` | Rollup status of the head commit. |
| `approved` / `changes requested` | GitHub's review decision, with a count when there is more than one approval. |
| `conflicts` | The branch no longer merges cleanly. |
| `3 open threads` | Unresolved, non-outdated review threads. |
| `you` | The request is addressed to you by name rather than to a team. |
| `Fuji` | The request came in through this team. |
| `you commented` | You have already left a comment but no verdict. |

## Running it as a background service

The `./pr-radar` script is the whole control surface:

| Command | What it does |
| --- | --- |
| `./pr-radar` | Start if needed, then open the browser |
| `./pr-radar start` | Start without opening a browser |
| `./pr-radar status` | Health, pid, uptime, how it is managed |
| `./pr-radar restart` | Restart it |
| `./pr-radar logs` | Follow the log |
| `./pr-radar stop` | Stop it |
| `./pr-radar build` | Rebuild the client, and restart if systemd manages it |
| `./pr-radar install` | Run it as a systemd user service, starting at login |
| `./pr-radar uninstall` | Remove the systemd user service |

`install` generates `~/.config/systemd/user/pr-radar.service` from the checkout's real
path and pins the `node` currently on your `PATH`, so it will not silently fall back to
an older system node. To keep it running when you are logged out:

```bash
sudo loginctl enable-linger "$USER"
```

The footer at the bottom of the page reports the live service state — systemd versus
hand-started, pid, uptime, port, state file — with every command one click from your
clipboard.

![Service footer](docs/screenshot-service.png)

### Giving it a hostname

A hosts entry maps a name to an address, not to a port, so add this:

```
127.0.0.1   pr-radar.test
```

Then browse to <http://pr-radar.test:4317>. `.test` is reserved by RFC 6761, so it can
never collide with a real domain — unlike `.local`, which collides with mDNS.

To drop the `:4317` you need something listening on port 80. The least invasive option is
a loopback redirect:

```bash
sudo nft add table ip nat 2>/dev/null || true
sudo nft 'add chain ip nat output { type nat hook output priority -100; }' 2>/dev/null || true
sudo nft add rule ip nat output ip daddr 127.0.0.1 tcp dport 80 redirect to :4317
```

An app launcher entry is also available:

```bash
cp pr-radar.desktop ~/.local/share/applications/
```

`.desktop` files cannot expand `~`, so edit the `Exec=` line if you cloned this
somewhere other than `~/Git/pr-radar`.

## Demo mode

To click around without touching GitHub — or to take screenshots worth sharing — run it
against a synthetic dataset:

```bash
PR_RADAR_DEMO=1 PR_RADAR_STATE=/tmp/pr-radar-demo.json PORT=4318 pnpm dev:server
```

Every response is fabricated: fake authors, repositories, build IDs, log digests, and
service paths. No GitHub or Azure credentials are read.

## Layout

```
server/     Express API
  github.ts       PR search and grouping
  checks.ts       failing check runs for one PR
  azureDevops.ts  ADO timeline, log digests, stage retry
  logDigest.ts    turns a raw CI log into the few lines that matter
  serviceInfo.ts  what the footer reports
  store.ts        JSON state (VIPs, dismissals)
shared/     Types used by both halves
src/        React client
```

## Notes

- Only open PRs are shown. Closed and merged ones drop off on their own.
- A dismissal sticks until you undo it. Dismissals for PRs that have closed are
  garbage-collected after 30 days.
- `pnpm install` prints an `ERR_PNPM_IGNORED_BUILDS` notice about `esbuild` and exits 0.
  esbuild ships prebuilt binaries through its platform-specific optional dependency, so
  its install script is not needed. `pnpm-workspace.yaml` declares that, and sets
  `verifyDepsBeforeRun: false` — without it, pnpm 11's pre-run dependency check turns the
  skipped script into a hard failure on every `pnpm build` and `pnpm dev`.
