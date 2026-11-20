---
name: verify-homelab
description: Verify the homelab-deploy skill (skills/homelab-deploy in this repo) against the live homelab servers svc-01 and svc-02. A read-only doctor compares the servers with the skill's Servers table; the drive deploys a traefik/whoami canary on svc-02, exposes it on the LAN, through Traefik and through the Cloudflare tunnel, updates it, forces a rollback, and removes it, with a verify script that exits non-zero on any failure. Use after editing homelab-deploy, when its Servers table may be stale, or before trusting it for a real deploy.
---

# Verify homelab-deploy

The thing under test is not an app in this repo. It is the deploy flow written in
[`skills/homelab-deploy/`](../../../skills/homelab-deploy/SKILL.md) (`SKILL.md`, `EXPOSE.md`,
`UPDATE.md`), run against the real servers. A pass means an agent following those files reaches
a working, narrowly exposed, updatable, roll-backable app on the homelab.

The repo copy is the source. `~/.agents/skills/homelab-deploy` is a symlink to the main checkout
`/home/dagd/Projects/agentic-utils/skills/homelab-deploy`, and `~/.claude/skills/homelab-deploy`
points at `~/.agents/skills/homelab-deploy`, so every agent on the laptop uses whatever the main
checkout has. Verify an edit from its worktree before it reaches main: the scripts below always
read the `homelab-deploy` beside them, not the global one.

## Ground rules

- **The user runs every `sudo` and every delete.** That covers `rm`, `docker compose down`,
  `docker image rm`, `docker rm`, removing a Cloudflare route, and pruning. Hand each one as a
  ready-to-paste block (`! ssh svc-0X '...'`). Never run them yourself. A plain "yes" is not
  approval. Ask the user to name the action, then verify the result yourself.
- **Touch only the canary's things.** The canary owns `~/stacks/whoami-canary` and the
  `whoami-canary` Compose project on svc-02, ports `18080` and `18081` on svc-02, the
  `whoami-canary` router and service in svc-01's `~/stacks/traefik/dynamic.yml`, and the hostnames
  `whoami-canary.dagdappshub.com` and `whoami-canary.local.dagdappshub.com`. All fixed values are
  in [`canary.json`](canary.json). Never recreate, stop or edit Jellyfin, Navidrome, calorie or
  Traefik itself.
- **Commit nothing to `~/stacks`.** The canary skips homelab-deploy step 7 (Commit) and the
  `dynamic.yml` commit from EXPOSE.md, so it adds no history to the servers' repo. Verifying the
  commit step needs a real app.
- **Run one canary at a time.** Names, ports and hostnames are fixed, so two runs would drive the
  same containers. The doctor BLOCKs while leftovers from an earlier run exist. Finish or clean
  that run first.

## Launch

There is nothing to start locally. The homelab is already running. Launch means opening a run:

```bash
cd .claude/skills/verify-homelab/scripts
./verify.py start            # prints RUN_ID, RUN_DIR and ROLLBACK_TAG (whoami-canary-rollback:<YYYYMMDD>)
./doctor.py --out "$RUN_DIR/doctor-before.txt"
```

Ready means `doctor.py` exits `0` or `1`, never `2` (see Doctor). Needs on the laptop: SSH
aliases `svc-01` and `svc-02` in `~/.ssh/config`, `python3` with PyYAML, `curl`, and LAN
access to `192.168.4.0/22`. Tailscale is also needed for the negative probes. The servers need
`docker`, `jq`, `curl`, `ss` and `git`, and the SSH users must be in the `docker` group. All of
this is already true.

## Doctor

`./doctor.py` is read-only (one SSH session per server). It checks each server's live state
against homelab-deploy's **Servers** table and its "Both:" line:

- LAN and Tailscale IPs, CPU and cores, RAM, root disk size and SSD/HDD, Ubuntu 24.04, docker-ce
  from Docker's apt repo, `/var/lib/docker`, global log rotation, the cloudflared service, and
  the Tailscale subnet route.
- The `Stacks in ~/stacks` row against the `~/stacks` folders and the running Compose projects.
- The `Listens beyond localhost` row against every socket that is not loopback or tailscaled's.
- Every Cloudflare tunnel route targets `127.0.0.1` and has a listener.
- Every Traefik `dynamic.yml` backend is listening on its server.
- `~/stacks` is clean and no `.env` is tracked.
- Canary leftovers.

Each line is `PASS`, `DRIFT` or `BLOCK`. Exit `2` (BLOCK) means do not drive: a server is
unreachable, Docker, cloudflared or Traefik is down, or a canary is left over. Exit `1` (DRIFT)
means the table or the server is wrong. Report each DRIFT line. The drive may still run. Fix the
table in this repo when the server is right. Hand the server fix to the user when the table is
right. Mid-drive, run `./doctor.py --allow-canary` so the running canary does not BLOCK.

## Drive

Follow homelab-deploy's own files step by step, with the canary's fixed answers. The commands are in
the feature map: read [`features/README.md`](features/README.md) first, then follow each feature
file in order:

1. [Deploy a stack](features/deploy-stack.md), then `./verify.py deployed`.
2. [Expose it](features/expose.md) on the LAN, through Traefik and through the tunnel, then
   `./verify.py exposed`. The tunnel route needs the user in the Cloudflare dashboard.
3. [Update it](features/update-stack.md), then `./verify.py updated`.
4. [Force a rollback](features/rollback.md): inject a fault, then
   `./verify.py updated --tag forced-fault` must exit `1`. Roll back with UPDATE.md step 7, then
   `./verify.py rolled-back`.
5. Cleanup (below), then `./verify.py cleaned`.

Stop at the first phase that exits non-zero, except the forced-fault run, which must fail.
Report what failed with its evidence path. Then go to Cleanup anyway, so nothing is stranded.

## Evidence

Every `verify.py` phase writes `~/.local/state/verify-homelab/runs/<RUN_ID>/<phase>/`:

- `checks.jsonl` holds one record per check.
- `transcript.log` holds every SSH command and curl with its output and exit code.
- `bodies/` holds each response body.
- `summary.txt` holds the pass count.

The phase exits non-zero when any check fails. `run.json` holds the run's state: image IDs,
the rollback tag and the result of each phase. The `runs/latest` symlink points at the newest
run. Pass `--run <RUN_ID>` to use another.

Proof standards the script enforces:

- **Real paths.** Each probe is a unique path (`/probe-<RUN_ID>-<phase>-<path>`) requested the way
  a user would: curl on the server, curl from the laptop to the LAN IP, HTTPS to
  `*.local.dagdappshub.com` through Traefik, and HTTPS to the public hostname through Cloudflare.
  It passes only when the body names this container's hostname and echoes the probe path, and
  when the response carries the path's own marker: `X-Forwarded-Host` for Traefik, `Cf-Ray` for
  the tunnel. The same probe must also appear in `docker logs`, which shows the request reached
  the container.
- **Exposure is no wider than declared.** The tunnel port listens only on `127.0.0.1`. The LAN
  port listens only on svc-02's LAN IP. This is checked three ways:
  1. Docker's `PortBindings` must equal the declared set.
  2. The live `ss` sockets on each port must equal the declared address.
  3. From the laptop, the tunnel port on the LAN IP, the tunnel port on the Tailscale IP, and the
     LAN port on the Tailscale IP must all fail to connect.

  A `0.0.0.0` or `::` binding fails all three. This was proven by a deliberate wide binding, stored
  as `deployed-wide-binding`.
- **Versions by image ID**, not by tag name. A tag can be moved: UPDATE.md's rollback retags.
- **Side effects:**
  - The route in `dynamic.yml` is checked field by field, and Jellyfin's route must still answer.
  - The tunnel ingress is read from cloudflared's live config (`127.0.0.1:20241/config`).
  - The rollback tag must exist with the deployed image's ID.

## Cleanup

Order matters: the agent restores the Traefik file, then the user runs the deletes.

1. **Traefik route (agent).** Restore `dynamic.yml` in place from the backup, which keeps the
   inode for the single-file bind mount. Run
   `ssh svc-01 'cd ~/stacks/traefik && cat dynamic.yml.bak-<YYYYMMDD> > dynamic.yml && git diff --quiet -- dynamic.yml && echo restored'`,
   then confirm `https://jellyfin.local.dagdappshub.com/` still answers `302`.
2. **Cloudflare route (user, dashboard).** Zero Trust → Networks → Tunnels → `svc_02` → Routes:
   delete the `whoami-canary.dagdappshub.com` published application. Then, in the
   `dagdappshub.com` zone → DNS → Records, delete the `whoami-canary` CNAME that adding the route
   created, if it is still there.
3. **Deletes (user, paste blocks).** Fill in `<YYYYMMDD>` from `ROLLBACK_TAG` and `<new image id>`
   from `run.json` → `new_image_id`. Add each scratch file the run created, such as a
   `docker-compose.yml.bak-*` left by the wide-binding test.

   ```bash
   ! ssh svc-02 'cd ~/stacks/whoami-canary && docker compose down && docker image rm traefik/whoami:v1.11.0 traefik/whoami:v1.12.0 whoami-canary-rollback:<YYYYMMDD> && (docker image rm <new image id> 2>/dev/null || true) && rm -rf ~/stacks/whoami-canary'
   ! ssh svc-01 'rm ~/stacks/traefik/dynamic.yml.bak-<YYYYMMDD>'
   ```

   The image removal is by tag. After the rollback, `traefik/whoami:v1.12.0` points at the old
   image and the real v1.12.0 image is left untagged, so it is removed by ID. Docker 29 hides
   untagged images from `docker image ls`, so list them with `docker image ls -a`.
4. **Prove it (agent).** Run `./verify.py cleaned`, then `./doctor.py` (no flag). Both must
   report no canary. The `cleaned` phase also checks that every earlier phase's evidence is still
   on disk.
   `dagdappshub.com` has a wildcard DNS record, so `whoami-canary.dagdappshub.com` keeps
   resolving after cleanup. `cleaned` compares its answer with an unused sibling name instead.
   Cloudflare `521`/`522` means no record is left. The tunnel's catch-all `404` means the CNAME is
   still there, or the route removal is still propagating. Re-run after a minute before asking the
   user to delete the CNAME.

Kept on purpose: the Let's Encrypt certificate for `whoami-canary.local.dagdappshub.com` in
Traefik's `acme.json`. The next run reuses it, so repeated runs don't hit Let's Encrypt rate
limits. Also kept: the evidence under `~/.local/state/verify-homelab/`. Never delete evidence
during cleanup.

## Helpers

All are in `scripts/`, are executable, and are run from that folder:

| Script | Invocation | What it does |
| --- | --- | --- |
| `doctor.py` | `./doctor.py [--allow-canary] [--out FILE]` | Read-only comparison of both servers against the Servers table. Exit 0/1/2 = OK/DRIFT/BLOCK. |
| `verify.py` | `./verify.py start` | Opens a run and records pre-existing canary images. |
| | `./verify.py deployed\|exposed\|updated\|rolled-back\|cleaned [--run ID] [--tag NAME]` | Runs the phase's checks, writes evidence, and exits 1 on any failure. `--tag` stores a deliberate-failure run beside the phase, so it doesn't overwrite the phase's evidence. |
| `homelab.py` | (imported) | Servers-table parser, SSH, socket parsing, and the canary config. |

## Maintenance

When homelab-deploy changes, re-run the drive. When a stack is added or removed on a server,
update the table's `Stacks in ~/stacks` and `Listens beyond localhost` rows in the same change,
or the doctor reports DRIFT. Keep the feature map in step with `/pstack:maintain-verification-skill`.
