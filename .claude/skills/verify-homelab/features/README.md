# homelab-deploy verification map

This directory is the maintained source for verifying the homelab-deploy flow
(`skills/homelab-deploy/`) on the live servers. Read this index first, then use the matching
feature file as the recipe. Each file is one part of homelab-deploy, as the agent following it
experiences it.

## Baseline preconditions

- `./verify.py start` has opened a run. `RUN_ID`, `RUN_DIR` and `ROLLBACK_TAG` come from its output.
- `./doctor.py --out "$RUN_DIR/doctor-before.txt"` exits `0` or `1`, with no `BLOCK` line and
  `canary leftovers: none` on both servers.
- The laptop is on the LAN (`192.168.4.0/22`) with Tailscale up.
- The canary's values come from `../canary.json`:
  - server `svc-02`, Compose project and folder `whoami-canary`;
  - image `traefik/whoami`, deployed `v1.11.0`, updated to `v1.12.0`;
  - tunnel exposure `127.0.0.1:18080`, LAN exposure `192.168.4.20:18081`;
  - `whoami-canary.dagdappshub.com` (tunnel) and `whoami-canary.local.dagdappshub.com` (Traefik).

## Driving conventions

- Run the features in file order. Each one starts from the state the previous one left.
- Run scripts from `.claude/skills/verify-homelab/scripts/`.
- Server commands go through the SSH aliases: `ssh svc-02 '...'`, `ssh svc-01 '...'`.
- Follow homelab-deploy's words for each step. These recipes fill in the canary's answers. They
  are not a shortcut around the skill: when a recipe and the skill disagree, report it.
- Every `sudo` and every delete (`rm`, `down`, `image rm`, a Cloudflare route removal) goes to
  the user as a paste block.
- Back up a server file before editing it, as `<file>.bak-<YYYYMMDD>` beside it.

## Proof and skip reporting

- A phase is proven only by its `./verify.py <phase>` exit code `0` and its evidence folder
  `$RUN_DIR/<phase>/`.
- A deliberate failure is proven by `--tag <name>` exiting `1` with the expected `FAIL` lines.
- Report an unreachable path with the command tried and the precondition that was not met. For
  example, the tunnel hostname was not added in the dashboard.
- Never report the tunnel path as verified through Traefik or the LAN, or the other way round.
  Each path has its own probe and marker.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the behavior. It then uses
exactly four H2 sections in this order: `Sub-features`, `How to get to it (user POV)`,
`Driving it with ssh and verify.py` (starting with `Preconditions:`), and `Gotchas`.

## Features

- [Deploy a stack](./deploy-stack.md) covers capacity, the compose rules, start and local proof,
  and exposure-narrow port publishing.
- [Expose it](./expose.md) covers the direct LAN port, the Traefik `*.local` route and the
  Cloudflare tunnel.
- [Update it](./update-stack.md) covers the rollback point and a registry-image tag update.
- [Force a rollback](./rollback.md) covers an injected failed verification and UPDATE.md's
  rollback.
