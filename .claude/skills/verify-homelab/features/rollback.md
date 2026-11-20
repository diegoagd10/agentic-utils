# Force a rollback

UPDATE.md Step 7 restores the rollback image when an update fails verification. Driving it means
the update must really fail its check. Then the rollback must bring the deployed image back on
every exposure path.

## Sub-features

- `rollback-trigger` injects a fault, and verification of the updated stack exits non-zero.
- `rollback-restore` retags the rollback image and recreates with `--pull never` (Step 7).
- `rollback-verify` checks every path again on the deployed image ID.

## How to get to it (user POV)

- Inside an update, UPDATE.md Step 6 fails, and the agent follows Step 7, "Roll back if
  verification fails".

## Driving it with ssh and verify.py

Preconditions:

- `./verify.py updated` passed in this run, so `run.json` has `old_image_id` and `new_image_id`.

- **Inject the fault.** Run
  `ssh svc-02 'curl -s -X POST -d 500 http://127.0.0.1:18080/health; curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:18080/health'`.
  The second curl prints `500`. whoami's `/health` returns whatever status was last POSTed to it,
  and only until the container is recreated.
- **Verification fails.** Run `./verify.py updated --tag forced-fault`. It exits `1`, and the
  only `FAIL` line is `app health /health: GET /health -> 500`.
- **Roll back (Step 7).** Run
  `ssh svc-02 'cd ~/stacks/whoami-canary && docker tag whoami-canary-rollback:<YYYYMMDD> traefik/whoami:v1.12.0 && docker compose up -d --pull never && docker compose ps'`.
  The container is recreated, still named `traefik/whoami:v1.12.0` in `ps`.
- **Proof.** Run `./verify.py rolled-back`. It exits `0` after every `exposed` check plus
  `version: rolled back`: the running image ID equals `old_image_id` and the rollback tag's ID.
  `/health` is `200` again.

## Gotchas

- Step 7 moves the tag in the compose file (`traefik/whoami:v1.12.0`) onto the old image. Nothing
  else changes: the compose file still names `v1.12.0`, and the real v1.12.0 image is left
  untagged. A later `docker compose pull` silently re-applies the update. Prove versions by image
  ID, never by the tag shown in `docker compose ps`.
- Cleanup has to remove the untagged v1.12.0 image by ID (`new_image_id`). Removing tags alone
  leaves it behind, and `verify.py cleaned` fails on it.
- The fault lives in the process, so any recreate clears it. The proof that the rollback worked
  is the image ID, not `/health` going back to `200`.
