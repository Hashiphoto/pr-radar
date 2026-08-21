# PR Radar

A local dashboard for the pull requests that actually need you.

![PR Radar](docs/screenshot-light.png)

<sub>All screenshots use the built-in demo dataset, not real pull requests.</sub>

## What it does

- **Groups you define** — every section on the page is a group you can name, scope, filter,
  reorder by dragging its heading, and edit in place from its own gear button. *Edit groups* at
  the bottom of the page (<kbd>g</kbd>) opens the full editor, where nothing is saved until you
  say so. Ships with VIP review requests, Review requested and My pull requests; change them or
  throw them away.
- **One table, one row per pull request** — status, name, repo, Jira issue, author, checks,
  human review and bot review, each its own column. Drag any column edge to resize it, double
  click to reset; the name column takes whatever is left.
- **Filters are the columns** — a group narrows any column to the values you pick from a
  multi-select, and *All* is the default. Several values in one column match any of them;
  different columns must all match. What a row shows is exactly what a group can filter on.
- **Review state, split human from bot** — changes requested, unresolved threads, awaiting
  review, approved, reviewed, not requested — the same six for people and for bots, so a
  CodeRabbit nit never reads as a human blocking you. A row carries every value it owns, because
  a pull request can have changes requested and still owe another review. The author is not one
  of its own reviewers: answering a bot on your own pull request is recorded as a review, and
  counting it would say a human had looked when none had.
- **Recently merged** — your merged pull requests from the last 14 days come along too, so
  `Merged` is a status you can group on rather than one the table could never show.
- **Per-group notifications** — mark any group *Notify* and get a desktop notification the
  moment a pull request lands in it.
- **Branch name and Jira issue on every row** — click the branch to copy it; the issue key
  in the title gets its own column, linked straight to Jira.
- **Not going to review** — set a pull request aside and it stops showing until you toggle
  *Not reviewing*. It stays in the groups it belongs to. Reversible any time.
- **Nudge a bot on a draft** — on a draft whose bot review is *Not requested*, that cell is a
  button that comments whatever you set as *Ask a bot for review* in settings, `@coderabbitai
  review` by default. Empty text hides it.
- **Shareable config** — everything in settings, groups included, is one JSON file. *Export
  config* writes it without your set-aside pull requests, so a teammate can import it as is.
- **Failing checks, explained inline** — click a `Failing` pill to expand the failing tests
  pulled straight out of the Azure Pipelines logs, then retry just the failed stage.
- Light and dark themes, text and repo filters, keyboard shortcuts (<kbd>r</kbd> refresh,
  <kbd>/</kbd> search, <kbd>d</kbd> dismissed, <kbd>g</kbd> groups, <kbd>,</kbd> settings),
  auto refresh.

![Failing check expanded](docs/screenshot-dark.png)

## Install

You need [Node](https://nodejs.org) 20+, [pnpm](https://pnpm.io), and the
[GitHub CLI](https://cli.github.com).

```bash
git clone https://github.com/Hashiphoto/pr-radar.git ~/Git/pr-radar
cd ~/Git/pr-radar
gh auth login          # skip if you already use gh
pnpm install
pnpm build
./pr-radar install     # run it as a background service, starting at login
```

That's it — it opens at <http://localhost:4317>.

Prefer not to install a service? Use `./pr-radar` instead of the last line to start it
just for this session.

## Managing it

| Command | |
| --- | --- |
| `./pr-radar` | Start it and open the browser |
| `./pr-radar status` | Health, pid, uptime |
| `./pr-radar restart` | Restart |
| `./pr-radar logs` | Follow the log |
| `./pr-radar stop` | Stop |
| `./pr-radar build` | Rebuild after changing the code |
| `./pr-radar install` | Install the background service |
| `./pr-radar uninstall` | Remove it |

The same information and commands are at the bottom of the page.

![Service footer](docs/screenshot-service.png)

## Optional extras

**Retrying CI.** Reading failure details and retrying builds needs Azure DevOps access.
It reuses your existing `az login`, so usually just:

```bash
az login
```

Or set `AZURE_DEVOPS_PAT` to a token with **Build (read and execute)**. Without either,
the panel still lists failing checks and links to Azure.

**Notifications.** Turn on *Desktop notifications* in settings (`,`), grant the browser's
prompt, then mark the groups you care about *Notify*. They fire while a PR Radar tab is open —
the first load after a reload only establishes the baseline, so you are told about arrivals
rather than about what was already waiting. Redefining a group re-establishes that baseline too,
so widening its filters does not announce everything it sweeps in.

**Jira links.** Set *Jira base URL* in settings to something like
`https://your-org.atlassian.net/browse`, and the Jira column links the first issue key in each title.

**Config.** Settings and groups live in `~/.config/pr-radar/state.json`, alongside the pull
requests you have set aside; `PR_RADAR_STATE` moves the file. *Export config* and *Import config*
at the bottom of settings (`,`) round-trip the settings half of it as `pr-radar-config.json`, so
sharing a set of groups is one file rather than a hand-edit. Importing replaces every setting in
the file it names and leaves your set-aside list alone.

**A nicer URL.** Add this to `/etc/hosts` for <http://pr-radar.test:4317>:

```
127.0.0.1   pr-radar.test
```

**Keep it running after logout.**

```bash
sudo loginctl enable-linger "$USER"
```

**Try it without GitHub.** `PR_RADAR_DEMO=1 pnpm dev:server` serves a fake dataset.

## Notes

Settings and dismissals live in `~/.config/pr-radar/state.json`. The server binds to
loopback only, since it exposes your private pull requests — set `HOST` to override.
GitHub auth comes from `PR_RADAR_TOKEN`, `GITHUB_TOKEN`, `GH_TOKEN`, or the `gh` CLI, in
that order; a manual token needs the `repo` and `read:org` scopes.

## License

MIT
