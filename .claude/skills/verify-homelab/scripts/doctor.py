#!/usr/bin/env python3
"""Read-only: compare the live state of svc-01 and svc-02 against homelab-deploy's Servers table.

Exit 0 when everything matches, 1 when only DRIFT lines exist (live state and table disagree,
or something is exposed wider than the table allows), 2 when a BLOCK line exists (the canary
drive cannot run: a server is unreachable, Docker/cloudflared/Traefik is down, or a previous
canary was not cleaned up).

  doctor.py                  # before a drive: canary leftovers BLOCK
  doctor.py --allow-canary   # mid-drive: the running canary is expected
  doctor.py --out FILE       # also write the report to FILE
"""

import argparse
import json
import sys

import yaml

sys.dont_write_bytecode = True
import homelab as hl  # noqa: E402

REMOTE = r"""
echo; echo "### hostname"; hostname
echo; echo "### ip"; ip -4 -o addr show | awk '{print $2, $4}'
echo; echo "### cpu"; lscpu | sed -n 's/^Model name:[[:space:]]*//p'
echo; echo "### nproc"; nproc
echo; echo "### mem_kb"; awk '/MemTotal/ {print $2}' /proc/meminfo
echo; echo "### root_disk"; lsblk -s -b -P -o NAME,SIZE,ROTA,TYPE "$(findmnt -no SOURCE /)"
echo; echo "### os"; . /etc/os-release; echo "$PRETTY_NAME"
echo; echo "### docker_pkg"; apt-cache policy docker-ce 2>/dev/null | grep -A1 '\*\*\*'
echo; echo "### docker_root"; docker info -f '{{.DockerRootDir}}' 2>&1
echo; echo "### daemon_json"; cat /etc/docker/daemon.json 2>&1
echo; echo "### dockerd_exec"; systemctl show docker -p ExecStart --value
echo; echo "### cloudflared"; systemctl is-active cloudflared
echo; echo "### ts_routes"; tailscale status --json 2>/dev/null | jq -c '.Self.PrimaryRoutes // []'
echo; echo "### stack_dirs"; find ~/stacks -mindepth 1 -maxdepth 1 -type d ! -name .git -printf '%f\n' | sort
echo; echo "### compose_ls"; docker compose ls -a --format json
echo; echo "### containers"; docker ps -a --format '{{json .}}'
echo; echo "### images"; docker image ls --format '{{.Repository}}:{{.Tag}} {{.ID}}'
echo; echo "### ss"; ss -tlnH
echo; echo "### git_status"; git -C ~/stacks status --porcelain
echo; echo "### git_env_tracked"; git -C ~/stacks ls-files | grep -E '(^|/)\.env$'
echo; echo "### env_ignored"; git -C ~/stacks check-ignore -q probe/.env && echo yes || echo no
echo; echo "### tunnel"; curl -s -m5 http://127.0.0.1:20241/config
echo; echo "### dynamic"; cat ~/stacks/traefik/dynamic.yml 2>/dev/null
echo; echo "### dynamic_head"; git -C ~/stacks show HEAD:traefik/dynamic.yml 2>/dev/null
echo; echo "### dynamic_backups"; ls ~/stacks/traefik/ 2>/dev/null | grep -E '^dynamic\.yml\.' || true
"""


class Report:
    def __init__(self):
        self.lines = []

    def add(self, level, server, check, detail=""):
        self.lines.append((level, server, check, detail))

    def check(self, ok, server, check, detail, level="DRIFT"):
        self.add("PASS" if ok else level, server, check, detail)

    def text(self):
        return "\n".join(f"{lvl:5} {srv:6} {chk}: {det}" for lvl, srv, chk, det in self.lines)

    def code(self):
        levels = {l[0] for l in self.lines}
        return 2 if "BLOCK" in levels else 1 if "DRIFT" in levels else 0


def tunnel_ingress(raw):
    try:
        return [i for i in json.loads(raw)["config"]["ingress"] if i.get("hostname")]
    except (ValueError, KeyError, TypeError):
        return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--allow-canary", action="store_true", help="treat a running canary as expected")
    ap.add_argument("--out", help="also write the report to this file")
    args = ap.parse_args()

    table = hl.servers_table()
    can = hl.canary()
    r = Report()
    facts = {}

    for srv in hl.SERVERS:
        exp = hl.expected(srv, table)
        rc, out, err = hl.ssh(srv, "bash -s", stdin=REMOTE)
        if rc != 0 and "### hostname" not in out:
            r.add("BLOCK", srv, "ssh", (err or out).strip().splitlines()[-1:] or f"exit {rc}")
            continue
        f = facts[srv] = hl.sections(out)
        r.check(f["hostname"] == srv, srv, "hostname", f["hostname"], "BLOCK")

        ips = dict(l.split(" ", 1)[::-1] for l in f["ip"].splitlines())  # addr/len -> iface
        addrs = {a.split("/")[0]: i for a, i in ips.items()}
        r.check(exp["lan_ip"] in addrs and addrs[exp["lan_ip"]] != "tailscale0", srv, "LAN IP",
                f"table {exp['lan_ip']}, live {sorted(a for a, i in addrs.items() if i not in ('lo', 'tailscale0', 'docker0') and not i.startswith('br-'))}", "BLOCK")
        r.check(addrs.get(exp["ts_ip"]) == "tailscale0", srv, "Tailscale IP",
                f"table {exp['ts_ip']}, live {[a for a, i in addrs.items() if i == 'tailscale0']}")

        cpu, cores = f["cpu"], int(f["nproc"])
        r.check(f" {exp['cpu']}-" in f" {cpu.split('Core(TM) ')[-1]}" and cores == exp["cores"], srv, "CPU",
                f"table {exp['cpu']} {exp['cores']} cores, live {cpu} {cores} cores")
        ram = int(f["mem_kb"]) / 1024 / 1024
        r.check(abs(ram - exp["ram_gb"]) < 0.15, srv, "RAM", f"table {exp['ram_gb']} GB, live {ram:.1f} GiB")
        disk = next((dict(kv.split("=", 1) for kv in l.replace('"', "").split()) for l in f["root_disk"].splitlines()
                     if 'TYPE="disk"' in l), {})
        size_gb = int(disk.get("SIZE", 0)) / 1024**3
        kind = {"0": "SSD", "1": "HDD"}.get(disk.get("ROTA"), "?")
        r.check(int(size_gb) == exp["disk_gb"] and kind == exp["disk_kind"], srv, "root disk",
                f"table {exp['disk_gb']} GB {exp['disk_kind']}, live {disk.get('NAME')} {size_gb:.1f} GiB {kind}")

        r.check(f["os"].startswith("Ubuntu 24.04"), srv, "OS", f["os"])
        r.check("download.docker.com" in f["docker_pkg"], srv, "docker-ce from apt", f["docker_pkg"].splitlines()[0] if f["docker_pkg"] else "docker-ce not installed")
        r.check(f["docker_root"] == "/var/lib/docker", srv, "Docker data dir", f["docker_root"], "BLOCK" if "error" in f["docker_root"].lower() else "DRIFT")
        try:
            logopts = json.loads(f["daemon_json"]).get("log-opts", {})
        except ValueError:
            logopts = {}
        r.check("max-size" in logopts, srv, "global log rotation", json.dumps(logopts))
        r.check(f["cloudflared"] == "active", srv, "cloudflared service", f["cloudflared"], "BLOCK")
        try:
            routes = json.loads(f["ts_routes"] or "[]")
        except ValueError:
            routes = None
        r.check(sorted(routes or []) == exp["subnet_routes"], srv, "Tailscale subnet routes",
                f"table {exp['subnet_routes']}, live {routes}")

        # Stacks: the table, the ~/stacks folders and the Compose projects must be the same set.
        canary_names = {can["app"]} if args.allow_canary and srv == can["server"] else set()
        dirs = set(f["stack_dirs"].split()) - canary_names
        projects = {p["Name"]: p["Status"] for p in json.loads(f["compose_ls"] or "[]")}
        r.check(dirs == set(exp["stacks"]), srv, "stack folders", f"table {exp['stacks']}, ~/stacks {sorted(dirs)}")
        for name in exp["stacks"]:
            r.check(projects.get(name, "").startswith("running"), srv, f"stack {name}", projects.get(name, "no Compose project"))
        for name in sorted(set(projects) - set(exp["stacks"]) - canary_names):
            r.add("DRIFT", srv, f"stack {name}", f"Compose project {projects[name]} is not in the table")

        # Listeners: anything beyond loopback must be a port the table names.
        allowed = set(exp["open_ports"])
        if srv == can["server"] and args.allow_canary:
            allowed |= {e["port"] for e in can["exposures"].values() if not hl.is_loopback(e["bind"])}
        wide = sorted({(a, p) for a, p in hl.listeners(f["ss"]) if not hl.is_loopback(a) and "%tailscale0" not in a})
        for a, p in wide:
            if p in allowed:
                continue
            note = ""
            if f":{p}" in f["dockerd_exec"]:
                note = " (dockerd -H tcp on this port: unauthenticated Docker API, root on the host for anyone who reaches it)"
            r.add("DRIFT", srv, f"listener {a}:{p}", f"not in 'Listens beyond localhost' {sorted(allowed)}{note}")
        if not any(p not in allowed for _, p in wide):
            r.add("PASS", srv, "listeners", f"beyond localhost only on {sorted({p for _, p in wide})}")

        # Tunnel ingress: every route must target 127.0.0.1 and something must listen there.
        ingress = tunnel_ingress(f["tunnel"])
        if ingress is None:
            r.add("BLOCK", srv, "tunnel config", "cloudflared metrics endpoint 127.0.0.1:20241/config did not answer")
        else:
            live = hl.listeners(f["ss"])
            for i in ingress:
                host = i["hostname"]
                if host == can["tunnel_hostname"] and not args.allow_canary:
                    r.add("BLOCK", srv, f"tunnel {host}", "canary route still in the tunnel: remove it in the Cloudflare dashboard")
                    continue
                svc = i["service"]
                port = int(svc.rsplit(":", 1)[-1]) if svc.startswith("http://") else None
                local = svc.startswith("http://127.0.0.1:")
                up = port is not None and any(p == port and (a.startswith("127.") or hl.is_wildcard(a)) for a, p in live)
                r.check(local and up, srv, f"tunnel {host}",
                        f"{svc} {'listening' if up else 'NOTHING LISTENS THERE'}{'' if local else ' (not 127.0.0.1)'}")

        changed = f["git_status"].splitlines()
        if args.allow_canary:
            changed = [l for l in changed if not l[3:].startswith((f"{can['app']}/", "traefik/dynamic.yml"))]
        r.check(not changed, srv, "~/stacks git clean",
                "clean" if not changed else f"{len(changed)} changed paths, e.g. {changed[0].strip()}")
        r.check(not f["git_env_tracked"] and f["env_ignored"] == "yes", srv, ".env gitignored",
                f"tracked .env: {f['git_env_tracked'].split() or 'none'}, ignored: {f['env_ignored']}")

        # Canary leftovers from an earlier run.
        if not args.allow_canary:
            left = []
            if can["app"] in f["stack_dirs"].split():
                left.append(f"~/stacks/{can['app']}")
            left += [c["Names"] for c in map(json.loads, filter(None, f["containers"].splitlines()))
                     if can["app"] in c.get("Labels", "") or can["app"] in c["Names"]]
            left += [l.split()[0] for l in f["images"].splitlines() if l.startswith((can["image"] + ":", can["app"] + "-rollback:"))]
            left += [f"~/stacks/traefik/{b}" for b in f["dynamic_backups"].split()]
            r.check(not left, srv, "canary leftovers", ", ".join(left) or "none", "BLOCK")

    # Traefik on svc-01: running, routes committed, every backend listening on its server.
    t = facts.get(hl.TRAEFIK_SERVER)
    if t:
        running = any(c["Names"] == "traefik" and c["State"] == "running"
                      for c in map(json.loads, filter(None, t["containers"].splitlines())))
        r.check(running, hl.TRAEFIK_SERVER, "Traefik container", "running" if running else "not running", "BLOCK")
        try:
            dyn = yaml.safe_load(t["dynamic"]) or {}
        except yaml.YAMLError as e:
            dyn = {}
            r.add("BLOCK", hl.TRAEFIK_SERVER, "dynamic.yml", f"does not parse: {e}")
        routers = dyn.get("http", {}).get("routers", {})
        services = dyn.get("http", {}).get("services", {})
        by_ip = {hl.expected(s, table)["lan_ip"]: s for s in hl.SERVERS}
        for name, router in routers.items():
            if name == can["app"] and not args.allow_canary:
                r.add("BLOCK", hl.TRAEFIK_SERVER, f"route {name}", "canary route still in dynamic.yml")
                continue
            for srv_def in services.get(router.get("service"), {}).get("loadBalancer", {}).get("servers", []):
                url = srv_def.get("url", "")
                hostport = url.split("//", 1)[-1].rstrip("/")
                ip, _, port = hostport.rpartition(":")
                owner = by_ip.get(ip)
                live = hl.listeners(facts[owner]["ss"]) if owner in facts else []
                up = any(p == int(port) and (a == ip or hl.is_wildcard(a)) for a, p in live)
                r.check(owner is not None and up, hl.TRAEFIK_SERVER, f"route {name}",
                        f"{router.get('rule')} -> {url} on {owner or 'unknown server'}: {'listening' if up else 'NOTHING LISTENS THERE'}")
        same = (t["dynamic"] == t["dynamic_head"])
        if not args.allow_canary:
            r.check(same, hl.TRAEFIK_SERVER, "dynamic.yml committed", "matches git HEAD" if same else "differs from git HEAD")

    report = r.text()
    print(report)
    summary = {0: "doctor: OK", 1: "doctor: DRIFT (drive may run; fix the table or the server)", 2: "doctor: BLOCK (do not drive)"}[r.code()]
    print(summary)
    if args.out:
        with open(args.out, "w") as fh:
            fh.write(f"{hl.now()}\n{report}\n{summary}\n")
    sys.exit(r.code())


if __name__ == "__main__":
    main()
