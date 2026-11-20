# Deploy a stack

homelab-deploy's Steps 1–5 turn an app into a stack `~/stacks/<app>/docker-compose.yml` on the
chosen server. The stack follows the compose rules, publishes each port only on the interface its
exposure needs, and answers a local curl.

## Sub-features

- `deploy-shape` gathers image, port, data, appetite and exposure (Step 1).
- `deploy-place` picks the server from the Role row (Step 2).
- `deploy-capacity` checks RAM, disk and a free port (Step 3).
- `deploy-rules` writes a compose file that follows Step 4's rules.
- `deploy-bind` publishes each port no wider than its exposure (Step 4, last bullet).
- `deploy-start` runs `docker compose up -d` and proves a local curl (Step 5).

## How to get to it (user POV)

- The user asks an agent to "deploy/host/self-host X on the homelab". The agent loads
  homelab-deploy and works through Steps 1–5.

## Driving it with ssh and verify.py

Preconditions:

- The baseline preconditions in the README hold.
- `ssh svc-02 'test -e ~/stacks/whoami-canary || echo absent'` prints `absent`.

- **Shape (Step 1).** Image `traefik/whoami:v1.11.0` (prebuilt, pinned tag), container port
  `80`, no data, a few MB of RAM, exposure public (tunnel) plus LAN (direct and Traefik). whoami
  has no host validation, so every hostname works.
- **Place (Step 2).** svc-02, fixed by `canary.json`. That puts the Traefik backend on the other
  server, which is the `dynamic.yml` path EXPOSE.md says svc-02 apps always take. Running this
  verify skill is the user's placement answer, so do not ask again.
- **Capacity (Step 3).** Run
  `ssh svc-02 'free -h; df -h /; docker stats --no-stream; ss -tlnH "( sport = :18080 or sport = :18081 )"'`.
  Available RAM must be above 100 MB and disk use below 90 %, and the `ss` output must be empty.
- **Write (Step 4).** Run this command:

  ```bash
  ssh svc-02 'mkdir ~/stacks/whoami-canary && cat > ~/stacks/whoami-canary/docker-compose.yml <<EOF
  name: whoami-canary

  services:
    whoami:
      image: traefik/whoami:v1.11.0
      restart: unless-stopped
      command: ["--verbose", "--name", "whoami-canary"]
      ports:
        - "127.0.0.1:18080:80"      # tunnel: cloudflared on this host
        - "192.168.4.20:18081:80"   # LAN: direct and Traefik on svc-01
  EOF
  cd ~/stacks/whoami-canary && docker compose config -q && echo config-ok'
  ```

  The command prints `config-ok` with no warnings. No `.env`: the canary has no secrets.
- **Start (Step 5).** Run
  `ssh svc-02 'cd ~/stacks/whoami-canary && docker compose up -d && docker compose ps && curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:18080/'`.
  The service is `Up` and the curl prints `200`. It is a new stack, so no `--dry-run` is needed.
- **Proof.** Run `./verify.py deployed`. It exits `0` after these checks:
  - the 5 `rule:` checks;
  - `container running`;
  - the 5 `exposure:` checks;
  - server-local and LAN probes from this container;
  - `/health` returns `200`;
  - the probes appear in `docker logs`;
  - `version: old tag`, which records `old_image_id` in `run.json`.
- **Negative proof (optional, once per change to the exposure checks).** Widen the LAN port and
  confirm the script fails, then restore the file:

  ```bash
  ssh svc-02 'cd ~/stacks/whoami-canary && cp -p docker-compose.yml docker-compose.yml.bak-wide && sed -i "s/\"192.168.4.20:18081:80\"/\"18081:80\"/" docker-compose.yml && docker compose up -d'
  ./verify.py deployed --tag wide-binding     # must exit 1
  ssh svc-02 'cd ~/stacks/whoami-canary && cat docker-compose.yml.bak-wide > docker-compose.yml && docker compose up -d && docker compose ps --format "{{.Ports}}"'
  ```

  It must fail exactly 3 checks: `exposure: docker port bindings`, `exposure: lan socket`
  (`0.0.0.0` and `::`), and `exposure: LAN port over Tailscale IP refused` (it answers `200`).
  `docker-compose.yml.bak-wide` goes away with the stack folder in Cleanup.

## Gotchas

- whoami is a scratch image with no shell or curl, so it has no compose healthcheck.
  `docker compose ps` shows `Up`, not `healthy`. That is expected: Step 5 says "healthy, if it has
  a healthcheck".
- The tunnel port probed from the LAN times out (curl exit `28`) instead of being refused. Docker
  drops non-loopback traffic to `127.0.0.1`-published ports. Both count as not reachable.
  Any HTTP status is a failure.
- `verify.py deployed` reads the compose file live. Restoring after the negative test recreates
  the container with a new hostname. Later phases read the hostname again, so this is harmless.
- Step 7 (Commit) is not exercised: the canary never commits to `~/stacks`.
