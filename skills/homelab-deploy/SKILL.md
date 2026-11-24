---
name: homelab-deploy
description: Deploy or update a Docker app on the homelab servers svc-01 or svc-02. Use when deploying, hosting, self-hosting, exposing or updating an app on the homelab, svc-01 or svc-02.
---

# Homelab deploy

Deploy one app as one **stack**: a folder `~/stacks/<app>/` holding a `docker-compose.yml`
(plus `.env` when it has secrets), run with `docker compose` on the chosen server.

**Updating** an app that already has a stack: follow [UPDATE.md](UPDATE.md) instead of the
Steps below; the Servers table and Guardrails still apply.

## Servers

Reach both from the laptop by SSH alias (`ssh svc-01`, `ssh svc-02`); aliases carry user and key.

| | svc-01 | svc-02 |
|---|---|---|
| LAN IP / Tailscale | 192.168.4.21 / 100.95.12.55 | 192.168.4.20 / 100.97.119.96 |
| Hardware | i5, 4 cores, 7.7 GB RAM, 113 GB **SSD** | i3, 4 cores, 3.7 GB RAM, 931 GB **HDD** |
| Role | **performance**: CPU/RAM-heavy, databases, latency-sensitive, APIs | **storage**: streaming, media, large files, backups |
| Stacks in `~/stacks` | `traefik` (LAN reverse proxy), `calorie` (open-calorie-tracker, tunnel-only, deployed by GitHub Actions; see [UPDATE.md](UPDATE.md) before touching it) | `jellyfin`, `navidrome` (tunnel-only); media in ~/media |
| Host services | Tailscale subnet router `192.168.4.0/22`, cloudflared | cloudflared |
| Listens beyond localhost | `22` SSH, `80` and `443` Traefik | `22` SSH, `8096` Jellyfin (host network) |

Keep the last three rows current when a stack is added or removed. The doctor in agentic-utils'
`.claude/skills/verify-homelab` checks the live servers against the backticked names and port
numbers.

Both: Ubuntu 24.04, docker-ce (apt, data in `/var/lib/docker`, global log rotation), cloudflared
as a host systemd service, git repo in `~/stacks` with `.env` gitignored.

## Steps

### 1. Gather the app's shape

Establish: image (prebuilt, or built from a repo), container port(s), persistent data paths and
expected size, RAM/CPU appetite, and **exposure**: public (internet), LAN, or private-remote.
Read the app's docs or code for host/origin validation (allowed hosts, base URL, trusted proxies):
it decides which hostnames can work.
Done when every item has a concrete value.

### 2. Ask where it goes

Placement is the user's call. Ask with AskUserQuestion, recommended server first, using the
**Role** row: storage/streaming → svc-02; performance → svc-01. State the reason in one line
(e.g. "media library needs the 931 GB disk").
Done when the user has picked a server.

### 3. Check capacity

On the chosen server: `free -h`, `df -h /`, `docker stats --no-stream`, and
`ss -tlnp` for the host port you intend to publish. Pick a free port.
Done when RAM, disk and port all fit; otherwise report the shortfall and return to step 2.

### 4. Write the stack

In `~/stacks/<app>/docker-compose.yml`:

- First line `name: <app>`; omit the obsolete `version:` key.
- When the compose file comes from the app's own repo (built-from-source), leave it as committed:
  put `name:` and every server-only setting in `docker-compose.override.yml` beside it, and sync
  source as in [UPDATE.md](UPDATE.md) → Syncing source.
- `restart: unless-stopped` on every service.
- Pin a real tag when upstream offers one; `latest` only for apps that are already on it here.
- Data as bind mounts under the user's home (`/home/<user>/<app>/...`); media on svc-02 from `~/media`.
- Secrets in `.env` beside the compose file, `chmod 600`; reference them as `${VAR}`.
- Publish ports to the narrowest interface the exposure needs:
  `127.0.0.1:<port>` for tunnel-only, `<LAN IP>:<port>` for LAN, `network_mode: host` only when
  the app needs discovery (as Jellyfin does).

Done when `docker compose config -q` passes with no unset-variable warnings.

### 5. Start and verify locally

`docker compose up -d`, then `docker compose ps` shows the service Up (healthy, if it has a
healthcheck), and `curl` from the server to the published port returns the app's expected status.
For a stack that already has containers, run `docker compose up -d --dry-run` first and tell the
user which containers it will recreate.
Done when the local curl succeeds.

### 6. Expose

Follow the recipe for each exposure the app needs in [EXPOSE.md](EXPOSE.md).
Done when a request through every chosen path reaches the new container: prove it with a
unique path (`/probe-<timestamp>`) found in `docker logs`, or an equivalent unambiguous signal.

### 7. Commit

`cd ~/stacks && git add <app> && git commit -m "Add <app>"`, after confirming
`git status` shows no `.env` staged.
Done when the commit exists and `git status` is clean.

## Guardrails

- Commands that need `sudo`, delete data, or remove containers/volumes/images: hand them to the
  user as a ready-to-paste block (`! ssh svc-0X '...'`, or their own terminal when `sudo` prompts
  for a password), then verify the result yourself.
- Back up a file on the server before editing it (`cp -p f f.bak-<date>`), and remove the backup
  once the user confirms the change works.
- Downtime is the user's to schedule: ask before recreating anything that serves Jellyfin or
  other media in use.
