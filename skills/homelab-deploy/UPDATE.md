# Updating an existing stack

The stack already lives in `~/stacks/<app>/` on its server; placement, ports and exposure stay
as they are. Every update carries a **rollback point**: the exact image the app runs now, kept
under a tag so one command restores it.

## 1. Identify the update source

Find which kind of stack it is from its compose file:

- **Registry image** (`image:` only): the new version comes from `docker compose pull`, or from
  editing a pinned tag to the target version.
- **Built from source** (`build:`, e.g. the `calorie` stack on svc-01, built from the open-calorie-tracker repo): the new version is a **commit**
  of the app's repo (usually under `~/Projects/` on the laptop). Ask the user which ref to
  deploy (default: the remote's default branch). The current version is the commit recorded in
  the last `~/stacks` git message for the app.

Done when you know the current version, the target version, and how the target arrives.

### Syncing source (built-from-source stacks)

Deploy committed code only: an exported commit carries exactly the tracked files, with no
laptop state (`data/`, `build/`, `node_modules/`, agent folders).

```bash
git -C <repo> fetch origin
rm -rf /tmp/<app>-src && mkdir /tmp/<app>-src
git -C <repo> archive <ref> | tar -x -C /tmp/<app>-src
rsync -a --delete --exclude .env --exclude docker-compose.override.yml \
  /tmp/<app>-src/ svc-0X:stacks/<app>/
```

Server-owned files survive the sync: `.env` (secrets) and `docker-compose.override.yml`
(server-specific settings such as `name:`, which Compose merges automatically). Put every
server-side compose tweak in the override, and keep the repo's `docker-compose.yml` byte-for-byte
as committed. Before the first sync of a stack that predates this rule, diff its compose against
the repo's and move each server-only line into the override.

## 2. Read what changes

Read the release notes / changelog / commit log between current and target. List anything that
breaks: database migrations, renamed or new env vars, changed ports or volumes, dropped
features. Report the list to the user, or state that it is empty.
Done when every release between current and target has been read.

## 3. Schedule the downtime

Recreating the container interrupts the app for seconds to minutes (image pulls on svc-02 are
slow on the HDD; a rebuild takes longer). Ask the user whether now is a good time, naming the
app and what stops working.
Done when the user says go.

## 4. Set the rollback point

```bash
cd ~/stacks/<app>
docker compose images                       # current image ID per service
docker tag <current-image-id> <app>-rollback:<date>
```

When step 2 found a migration or the app keeps state in a database, also copy its data
directory while the app is stopped (`docker compose stop`, copy, then continue). Ask first if
the directory is large (Jellyfin's `config` holds metadata and can be several GB).
Done when `docker image ls <app>-rollback` shows the tag.

## 5. Update

```bash
docker compose pull            # registry images (or after editing the pinned tag)
docker compose up -d --build   # --build only for built-from-source stacks
docker compose ps
```

Done when the service is Up (healthy, if it has a healthcheck).

## 6. Verify

Check the app responds through every exposure path it had before (local curl, Cloudflare
hostname, `*.local` route), and that `docker compose logs --since 5m` shows no errors or failed
migrations. Confirm the running version is the target (image digest, `/version` endpoint, or
the version in the logs).
Done when every path answers as before and the version matches the target.

## 7. Roll back if verification fails

```bash
docker tag <app>-rollback:<date> <image-name>:<tag-in-compose>
docker compose up -d --pull never
```

For built-from-source stacks, also restore the previous source: `git -C ~/stacks checkout -- <app>`.
If a data copy was taken in step 4, restore it with the app stopped. Tell the user what failed.

## 8. Clean up and commit

- Commit any compose or source change: `cd ~/stacks && git add -A <app> && git commit -m "Update <app> to <version>"`
  (for built-from-source stacks, `<version>` is the deployed commit hash, so the next update knows its starting point).
- Remove the rollback tag once the user confirms the app works: `docker image rm <app>-rollback:<date>`.
- `docker image prune` reclaims the old layers; hand it to the user per the Guardrails.
