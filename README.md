# PR Radar

A local dashboard for the pull requests that actually need you.

![PR Radar](docs/screenshot-light.png)

<sub>All screenshots use the built-in demo dataset, not real pull requests.</sub>

## What it does

- **VIP review requests** — a pinned section for the people you care about most.
- **Review requested** — everything else waiting on you, oldest first.
- **My pull requests** — your own, grouped by state: changes requested, awaiting review, approved, draft.
- **Not going to review** — set a PR aside so it leaves the queue. Reversible any time.
- **Failing checks, explained inline** — click a `checks failed` badge to see the failing tests
  pulled straight out of the Azure Pipelines logs, then retry just the failed stage.
- Light and dark themes, text and repo filters, keyboard shortcuts, auto refresh.

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
