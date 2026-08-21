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
- **Tags** — each pull request is tagged along every dimension: ready/draft, VIP author,
  approved, human review, bot review, checks and mergeability. A group is just a set of tags:
  several in one dimension match any of them, tags in different dimensions must all match.
- **Review state, split human from bot** — not requested, awaiting review, reviewed, unresolved
  threads, no unresolved threads, approved — the same six for people and for bots, so a
  CodeRabbit nit never reads as a human blocking you. They overlap on purpose: a pull request
  can be reviewed *and* approved *and* still have a thread open, and each of those is its own
  tag to filter on.
- **Per-group notifications** — mark any group *Notify* and get a desktop notification the
  moment a pull request lands in it.
- **Branch name and Jira issue on every card** — click the branch to copy it; the issue key
  in the title links straight to Jira.
- **Not going to review** — set a PR aside so it leaves the queue. Reversible any time.
- **Failing checks, explained inline** — click a `checks failed` badge to see the failing tests
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
so widening its tags does not announce everything it sweeps in.

**Jira links.** Set *Jira base URL* in settings to something like
`https://your-org.atlassian.net/browse`, and each card links the first issue key in its title.

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
