# Update it

UPDATE.md updates an existing registry-image stack: identify the source, read what changes,
schedule downtime, set a rollback point tagged with the current image, update the pinned tag,
and verify every exposure path still answers on the new version.

## Sub-features

- `update-source` identifies a registry-image stack and its current and target tags (Step 1).
- `update-changes` reads every release between current and target (Step 2).
- `update-rollback-point` tags the running image as `<app>-rollback:<date>` (Step 4).
- `update-apply` edits the pinned tag, pulls and recreates (Step 5).
- `update-verify` checks every path and the running version (Step 6).

## How to get to it (user POV)

- The user asks an agent to "update X on the homelab". homelab-deploy sends it to UPDATE.md.

## Driving it with ssh and verify.py

Preconditions:

- `./verify.py exposed` passed in this run.

- **Source (Step 1).** `ssh svc-02 'grep image: ~/stacks/whoami-canary/docker-compose.yml'`
  shows `traefik/whoami:v1.11.0`: a registry image. The target is `v1.12.0`.
- **Changes (Step 2).** Run
  `gh api repos/traefik/whoami/compare/v1.11.0...v1.12.0 --jq '.commits[].commit.message|split("\n")[0]'`.
  Its output, as of 2026-11, is: a gRPC endpoint, an OpenAPI spec, and Dockerfile and release
  fixes. No flag, port or path changes: the breaking list is empty.
- **Downtime (Step 3).** The canary has no users. Running this verify skill counts as the go.
- **Rollback point (Step 4).** Run
  `ssh svc-02 'cd ~/stacks/whoami-canary && docker compose images && docker tag $(docker compose images -q whoami) whoami-canary-rollback:<YYYYMMDD> && docker image ls whoami-canary-rollback'`.
  The tag is listed with the deployed image ID. No data to copy.
- **Apply (Step 5).** Run
  `ssh svc-02 'cd ~/stacks/whoami-canary && sed -i "s#traefik/whoami:v1.11.0#traefik/whoami:v1.12.0#" docker-compose.yml && docker compose pull && docker compose up -d && docker compose ps'`.
  The service is `Up` on `traefik/whoami:v1.12.0`.
- **Proof (Step 6).** Run `./verify.py updated`. It exits `0` after every `exposed` check plus:
  - `version: rollback point`: the rollback tag's ID equals `old_image_id`;
  - `version: new tag`: the running ID is `v1.12.0`'s and differs from the old one. This records
    `new_image_id`.

## Gotchas

- `docker compose images -q whoami` prints the image ID the container runs. Read it before the
  update: afterwards the same command prints the new ID.
- svc-02's HDD makes pulls slow for big images. whoami is about 3 MB, so this does not show here.
- Step 8 (commit, remove the rollback tag, `docker image prune`) is replaced by this skill's
  Cleanup. The canary commits nothing.
