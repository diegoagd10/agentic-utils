# Expose it

EXPOSE.md makes a stack reachable over three paths: directly on the server's LAN IP, over HTTPS
on `https://<sub>.local.dagdappshub.com` through Traefik on svc-01, and publicly through the
server's Cloudflare tunnel. Each path reaches the same container, and none of them widens a port
binding.

## Sub-features

- `expose-lan` serves the app on `http://<LAN IP>:<port>` from any LAN or Tailscale device.
- `expose-traefik` adds a router and a service to svc-01's `dynamic.yml`, gets a Let's Encrypt
  certificate, and serves HTTPS on `*.local.dagdappshub.com`.
- `expose-tunnel` adds a dashboard route `<sub>.dagdappshub.com → http://127.0.0.1:<port>` and
  serves through Cloudflare.
- `expose-no-regression` keeps existing Traefik routes answering after `dynamic.yml` changes.

## How to get to it (user POV)

- homelab-deploy Step 6, "Expose", sends the agent to EXPOSE.md's three recipes.

## Driving it with ssh and verify.py

Preconditions:

- `./verify.py deployed` passed in this run.
- `ssh svc-01 'grep -c whoami-canary ~/stacks/traefik/dynamic.yml'` prints `0`.

- **LAN.** Nothing to add. The `192.168.4.20:18081` binding from Step 4 is the LAN path. It is
  proven again in every phase as `path: LAN direct from laptop`.
- **Traefik, back up.** Run
  `ssh svc-01 'cd ~/stacks/traefik && cp -p dynamic.yml dynamic.yml.bak-<YYYYMMDD> && stat -c %i dynamic.yml'`
  and note the inode.
- **Traefik, write.** Fetch the file. Add the router under `http.routers` and the service under
  `http.services`. Check the result locally with `python3 -c 'import yaml,sys; yaml.safe_load(sys.stdin)'`.
  Then write it in place with `ssh svc-01 'cat > ~/stacks/traefik/dynamic.yml' < dynamic.new.yml`.
  The router and service:

  ```yaml
      whoami-canary:
        rule: "Host(`whoami-canary.local.dagdappshub.com`)"
        entryPoints: [websecure]
        service: whoami-canary
        tls:
          certResolver: cloudflare
  # under services:
      whoami-canary:
        loadBalancer:
          servers:
            - url: "http://192.168.4.20:18081"
  ```

  `stat -c %i` must print the same inode as before. Then
  `ssh svc-01 'docker logs --since 1m traefik 2>&1 | grep whoami-canary'` shows `dns01` lines
  for the certificate.
- **Tunnel (user).** Give the user exactly this line: Zero Trust → Networks → Tunnels → `svc_02` →
  Routes → Add route → Published application, with subdomain `whoami-canary`, domain
  `dagdappshub.com` and service URL `http://127.0.0.1:18080`. The dashboard also creates the
  `whoami-canary` CNAME to `<tunnel id>.cfargotunnel.com`.
  Wait for them to confirm. Then read the live ingress with
  `ssh svc-02 'curl -s http://127.0.0.1:20241/config' | jq '.config.ingress[] | select(.hostname=="whoami-canary.dagdappshub.com")'`.
  It shows `"service": "http://127.0.0.1:18080"`.
- **Proof.** Run `./verify.py exposed`. It exits `0` after every `deployed` check plus:
  - `traefik: route in dynamic.yml`;
  - `path: Traefik HTTPS` (`200`, `ssl_verify=0`, `X-Forwarded-Host`, this container);
  - `traefik: existing route still answers` (Jellyfin `302`);
  - `tunnel: ingress route`;
  - `path: Cloudflare tunnel` (`200`, `Cf-Ray`, this container).

## Gotchas

- The first HTTPS requests after the write get Traefik's default certificate (`ssl_verify=1`).
  Issuing the DNS-01 certificate takes about 10–60 s. `verify.py` polls for 150 s. Never pass
  `-k`.
- A `dynamic.yml` that does not parse drops every file route, including Jellyfin's. Parse it on
  the laptop before writing. The no-regression check catches a broken file afterwards.
- `cp` + `mv`, or an editor that replaces the file, breaks the single-file bind mount: Traefik
  keeps the old inode and never sees the change. Write with `cat >` only.
- The public hostname's DNS record appears a few seconds after the dashboard save. If the laptop
  looked it up earlier it may have an NXDOMAIN cached. `verify.py` polls for 180 s.
- Before the dashboard route exists, `https://whoami-canary.dagdappshub.com/` answers Cloudflare
  `521`, not NXDOMAIN, because the hostname already resolves through Cloudflare. A `521` means
  the tunnel has no route yet, not that the container is down. Proven in run
  `20261120-141221/exposed-pre-tunnel`.
- whoami echoes the request headers, so the tunnel path is briefly a public page that shows
  visitors their own IP and headers. Keep the window short, and remove the route in Cleanup.
- Do not commit the `dynamic.yml` change, even though EXPOSE.md says to for real apps.
