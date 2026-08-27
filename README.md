# PR Radar

A local dashboard for pull requests across repos.

![PR Radar](docs/screenshot-light.png)

<sub>All screenshots use the built-in demo dataset, not real pull requests.</sub>

## What it does

- **Groups you define** — every section on the page is a group you name, filter, reorder, color
  and edit in place. The filters are the columns themselves, and exactly one value per column is
  true of any pull request, so a set of groups either covers every one of them exactly once or it
  does not. The shipped set is the flow your own work moves through; change it or throw it away.
- **Shareable config** — everything in settings, groups included, is one JSON file. *Export
  config* writes it without your set-aside pull requests, so a teammate can import it as is.
- **Per-group notifications** — mark any group *Notify* and get a desktop notification the moment
  a pull request lands in it.
- **And more!** — human and bot reviews as separate columns, open threads as their own question,
  failing Azure Pipelines tests expanded inline with a retry, branch and Jira links on every row,
  set-aside pull requests, light and dark themes, keyboard shortcuts, and a stated rule behind
  every pill (<kbd>?</kbd>).

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
| `./pr-radar start --lan` | Start it reachable from your phone, too |
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
so widening its filters does not announce everything it sweeps in. *Send test notification*
sends one on the spot, through the same code an arrival goes through, so what you see is the real
thing with obvious stand-in text. It also tells you whether the browser said it showed it, which is
the difference between a setting being off and your desktop swallowing it.

**Jira links.** Set *Jira base URL* in settings to something like
`https://your-org.atlassian.net/browse`, and the Jira column links the first issue key in each title.

**Config.** Settings and groups live in `~/.config/pr-radar/config.json`, alongside the pull
requests you have set aside; `PR_RADAR_CONFIG` moves the file. *Export config* and *Import
config* at the bottom of settings (`,`) round-trip the settings half of it as
`pr-radar-config.json`, so sharing a set of groups is one file rather than a hand-edit. Importing
replaces every setting in the file it names and leaves your set-aside list alone. *Reset to
defaults* puts every setting back, groups included, after one confirmation, and also leaves that
list alone. Those defaults are `server/defaults.json`, so changing what a fresh install starts
with is an edit to that file rather than to the code.

**Keep it running after logout.**

```bash
sudo loginctl enable-linger "$USER"
```

**Reach it from your phone.** PR Radar answers on loopback, so nothing but the machine running it
can open it. `--lan` binds every interface instead:

```bash
./pr-radar start --lan       # until it stops
./pr-radar install --lan     # and every start after a reboot
```

Then type the address it prints. The startup log lists one per interface, since your wifi card and
a docker bridge are equally "not loopback" and only one of them is the one you want, and the footer
at the bottom of the page says `port 4317 (on your network)` and repeats the list, so an exposed
instance is not one you can leave running without knowing. There is no login: anyone who can reach
that port reads your pull requests and can retry your builds, so keep it to networks you trust.
`./pr-radar install` with no flag rewrites the unit without the setting, which is how it goes back.

Starting the server yourself takes the same flag, `PR_RADAR_LAN=1` if an environment variable fits
better, and `HOST` to pin one address rather than all of them. There is no setting for any of this
in the page, on purpose: settings are editable over the API, and what the server binds to should
not be something a browser tab can change. For the Vite dev server, `pnpm dev:client --host` is
Vite's own equivalent.

**Try it without GitHub.** `PR_RADAR_DEMO=1 pnpm dev:server` serves a fake dataset.

## Notes

Settings and dismissals live in `~/.config/pr-radar/config.json`. The server binds to loopback,
since it exposes your private pull requests and can retry your builds with no login of its own —
`--lan` above is how to reach it from another device, and `HOST` still pins a single address.
GitHub auth comes from `PR_RADAR_TOKEN`, `GITHUB_TOKEN`, `GH_TOKEN`, or the `gh` CLI, in
that order; a manual token needs the `repo` and `read:org` scopes. If an organization enforces
SAML SSO, the token has to be authorized for it too — GitHub answers search without that
organization's pull requests rather than erroring, so PR Radar checks on every refresh and puts
GitHub's own refusal, and the link that clears it, above your groups.

## License

MIT
