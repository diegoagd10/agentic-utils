# Exposure recipes

Every path targets a **host port** (`127.0.0.1:<port>` or `<LAN IP>:<port>`), never a container
IP: container IPs change when a container is recreated.

## Public: Cloudflare Tunnel

For apps used from anywhere without Tailscale (e.g. `music.dagdappshub.com`).

1. Publish the app on `127.0.0.1:<port>` on the server whose tunnel will carry it.
2. Tunnels are remote-managed (token mode): the user adds the route in the Cloudflare dashboard,
   Zero Trust → Networks → Tunnels → the server's tunnel → Public Hostnames:
   `<sub>.dagdappshub.com` → `http://127.0.0.1:<port>`. Give them exactly that line.
3. Read the live ingress to confirm: `ssh svc-0X 'curl -s http://127.0.0.1:20241/config'`.
4. Put the app's own login in front of anything sensitive; the tunnel makes it internet-facing.

## LAN: Traefik on svc-01

For HTTPS on `https://<sub>.local.dagdappshub.com` inside the house (and remotely via Tailscale).

- DNS is already done: public wildcard `*.local.dagdappshub.com` → `192.168.4.21`.
- Certificates are automatic: Let's Encrypt DNS-01 via Cloudflare, resolver `cloudflare`.
- Routes live in the file provider `~/stacks/traefik/dynamic.yml` on svc-01 (git-tracked; commit
  route changes like any stack change). Docker labels only reach
  Traefik for containers on svc-01 itself, so apps on svc-02 always go through this file.

Add a router and a service:

```yaml
http:
  routers:
    <app>:
      rule: "Host(`<sub>.local.dagdappshub.com`)"
      entryPoints: [websecure]
      service: <app>
      tls:
        certResolver: cloudflare
  services:
    <app>:
      loadBalancer:
        servers:
          - url: "http://<LAN IP of the app's server>:<port>"
```

- The app's port must be published on the LAN IP (step 4), since Traefik connects from svc-01.
- `dynamic.yml` is a single-file bind mount: write it in place (`cat > dynamic.yml`), keeping the
  inode, so Traefik's watcher sees the change. No restart needed.
- The app must accept `Host: <sub>.local.dagdappshub.com`. Apps that pin their allowed host
  (open-calorie-tracker returns 421 to any host but its configured `LAN_URL`) cannot sit behind
  this route without an app-side change; tell the user and offer the direct `http://<IP>:<port>`.
- Verify: `curl -s -o /dev/null -w "%{http_code} ssl_verify=%{ssl_verify_result}\n" https://<sub>.local.dagdappshub.com/`
  expects the app's status and `ssl_verify=0`.

## Private remote: Tailscale

Nothing to configure. svc-01 is a subnet router for `192.168.4.0/22`, so any LAN address or
`*.local` route works from the user's devices with Tailscale on. Each server is also reachable at
its Tailscale IP / `svc-0X.tail2ca352.ts.net`.
