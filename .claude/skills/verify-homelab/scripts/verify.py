#!/usr/bin/env python3
"""Evidence for the whoami canary drive. Every phase exits non-zero when any check fails.

  verify.py start                      # new run: prints RUN_ID and the evidence folder
  verify.py deployed    [--run ID]     # stack follows the deploy rules, answers locally and on the LAN
  verify.py exposed     [--run ID]     # ... and through Traefik and the Cloudflare tunnel
  verify.py updated     [--run ID]     # ... on the new tag, with the rollback point set
  verify.py rolled-back [--run ID]     # ... back on the rollback image
  verify.py cleaned     [--run ID]     # nothing of the canary is left, the evidence is
  verify.py <phase> --tag NAME         # same checks, evidence under <phase>-NAME (negative runs)

Every phase except `cleaned` also proves each published port is bound exactly to its exposure:
the tunnel port only on 127.0.0.1, the LAN port only on the server's LAN IP, never 0.0.0.0, ::
or the Tailscale IP, both in Docker's port bindings, in the live sockets, and from the laptop.
Evidence lands in ~/.local/state/verify-homelab/runs/<RUN_ID>/<phase>/. --run defaults to the latest run.
"""

import argparse
import json
import re
import subprocess
import sys
import time

import yaml

sys.dont_write_bytecode = True
import homelab as hl  # noqa: E402

PHASES = ("deployed", "exposed", "updated", "rolled-back", "cleaned")


class Run:
    def __init__(self, run_id, phase, tag=None):
        self.dir = hl.RUNS_DIR / run_id
        if not (self.dir / "run.json").exists():
            hl.die(f"no run {run_id} under {hl.RUNS_DIR}; start one with: verify.py start")
        self.state = json.loads((self.dir / "run.json").read_text())
        self.label = f"{phase}-{tag}" if tag else phase
        self.phase_dir = self.dir / self.label
        self.phase_dir.mkdir(exist_ok=True)
        (self.phase_dir / "bodies").mkdir(exist_ok=True)
        self.transcript = open(self.phase_dir / "transcript.log", "w")
        self.checks = []
        self.phase = phase

    def save(self):
        (self.dir / "run.json").write_text(json.dumps(self.state, indent=2) + "\n")

    def log(self, title, text):
        self.transcript.write(f"\n===== {hl.now()} {title}\n{text.rstrip()}\n")
        self.transcript.flush()

    def ssh(self, host, cmd, stdin=None):
        rc, out, err = hl.ssh(host, cmd, stdin=stdin)
        self.log(f"ssh {host} (exit {rc})", f"$ {cmd if stdin is None else stdin}\n--- stdout\n{out}\n--- stderr\n{err}")
        return rc, out, err

    def curl(self, url, name, extra=()):
        body_file = self.phase_dir / "bodies" / f"{name}.txt"
        cmd = ["curl", "-sS", "-m", "8", "-o", str(body_file), "-w", "%{http_code} %{ssl_verify_result}", *extra, url]
        p = subprocess.run(cmd, capture_output=True, text=True)
        body = body_file.read_text(errors="replace") if body_file.exists() else ""
        code, _, ssl = p.stdout.partition(" ")
        self.log(f"curl {name} (exit {p.returncode})", f"$ {' '.join(cmd)}\n{p.stdout}\n{p.stderr}\n--- body\n{body[:2000]}")
        return p.returncode, code, ssl, body

    def check(self, name, ok, detail):
        self.checks.append({"check": name, "ok": bool(ok), "detail": detail})
        print(f"{'PASS' if ok else 'FAIL'}  {name}: {detail}")
        return ok

    def finish(self):
        failed = [c for c in self.checks if not c["ok"]]
        with open(self.phase_dir / "checks.jsonl", "w") as fh:
            for c in self.checks:
                fh.write(json.dumps(c) + "\n")
        summary = f"{self.label}: {len(self.checks) - len(failed)}/{len(self.checks)} passed" + (
            f", FAILED: {', '.join(c['check'] for c in failed)}" if failed else "")
        (self.phase_dir / "summary.txt").write_text(f"{hl.now()}\n{summary}\n")
        self.state.setdefault("phases", {})[self.label] = {"at": hl.now(), "passed": not failed}
        self.save()
        print(summary)
        print(f"evidence: {self.phase_dir}")
        sys.exit(1 if failed else 0)


def start():
    can = hl.canary()
    run_id = time.strftime("%Y%m%d-%H%M%S")
    d = hl.RUNS_DIR / run_id
    d.mkdir(parents=True)
    rc, out, _ = hl.ssh(can["server"], "docker image ls --no-trunc --format '{{.Repository}}:{{.Tag}} {{.ID}}'")
    if rc != 0:
        hl.die(f"cannot list images on {can['server']}")
    before = [l for l in out.splitlines() if l.startswith((can["image"] + ":", can["app"] + "-rollback:"))]
    state = {"run_id": run_id, "started": hl.now(), "canary": can, "rollback_tag": f"{can['app']}-rollback:{hl.today()}",
             "canary_images_before": before}
    (d / "run.json").write_text(json.dumps(state, indent=2) + "\n")
    latest = hl.RUNS_DIR / "latest"
    latest.unlink(missing_ok=True)
    latest.symlink_to(run_id)
    print(f"RUN_ID={run_id}\nRUN_DIR={d}\nROLLBACK_TAG={state['rollback_tag']}")
    if before:
        print(f"WARNING: canary images already on {can['server']}: {before}", file=sys.stderr)


REMOTE = r"""
APP={app}
cd ~/stacks 2>/dev/null
echo; echo "### dir"; test -d ~/stacks/$APP && echo present || echo absent
echo; echo "### compose"; cat ~/stacks/$APP/docker-compose.yml 2>/dev/null
echo; echo "### config"; (cd ~/stacks/$APP 2>/dev/null && docker compose config -q 2>&1; echo "rc=$?")
echo; echo "### inspect"; ids=$(docker ps -aq --filter label=com.docker.compose.project=$APP); [ -n "$ids" ] && docker inspect $ids || echo '[]'
echo; echo "### images"; docker image ls -a --no-trunc --format '{{{{.Repository}}}}:{{{{.Tag}}}} {{{{.ID}}}}'
echo; echo "### ss"; ss -tlnH
echo; echo "### tunnel"; curl -s -m5 http://127.0.0.1:20241/config
echo; echo "### logs"; for i in $ids; do docker logs --since 2h $i 2>&1 | tail -300; done
echo; echo "### git"; git -C ~/stacks status --porcelain -- $APP
"""


def remote_state(run, can):
    _, out, _ = run.ssh(can["server"], "bash -s", stdin=REMOTE.format(app=can["app"]))
    s = hl.sections(out)
    s["inspect"] = json.loads(s.get("inspect") or "[]")
    s["image_list"] = [tuple(l.split(" ", 1)) for l in s.get("images", "").splitlines() if " " in l]
    s["images"] = {k: v for k, v in s["image_list"] if k != "<none>:<none>"}
    s["tunnel_ingress"] = [i for i in json.loads(s.get("tunnel") or '{"config":{"ingress":[]}}')["config"]["ingress"] if i.get("hostname")]
    return s


def traefik_state(run):
    _, out, _ = run.ssh(hl.TRAEFIK_SERVER, "cat ~/stacks/traefik/dynamic.yml; echo; echo '### head'; git -C ~/stacks show HEAD:traefik/dynamic.yml;"
                                         " echo; echo '### backups'; ls ~/stacks/traefik | grep -E '^dynamic\\.yml\\.' || true")
    current, _, rest = out.partition("\n### head\n")
    head, _, backups = rest.partition("\n### backups\n")
    return current.strip(), head.strip(), backups.split()


def body_from(body, hostname, path):
    return f"Hostname: {hostname}" in body and f"GET {path} HTTP/" in body


def check_rules(run, can, s):
    compose = s.get("compose", "")
    lines = [l for l in compose.splitlines() if l.strip()]
    run.check("rule: name first line", lines[:1] == [f"name: {can['app']}"], (lines[:1] or ["<no compose file>"])[0])
    run.check("rule: no version key", not re.search(r"^version:", compose, re.M), "absent" if "version:" not in compose else "present")
    try:
        services = (yaml.safe_load(compose) or {}).get("services", {})
    except yaml.YAMLError as e:
        services = {}
        run.check("rule: compose parses", False, str(e))
    run.check("rule: restart unless-stopped", services and all(v.get("restart") == "unless-stopped" for v in services.values()),
              {k: v.get("restart") for k, v in services.items()})
    images = [v.get("image", "") for v in services.values()]
    run.check("rule: pinned tag", images and all(re.search(r":v?\d", i) and not i.endswith(":latest") for i in images), images)
    config = s.get("config", "")
    run.check("rule: compose config -q", config.strip() == "rc=0", config.strip() or "<no output>")


def check_container(run, can, s):
    """Exactly one running canary container; returns its inspect record or None."""
    running = [c for c in s["inspect"] if c["State"]["Running"]]
    ok = run.check("container running", len(s["inspect"]) == 1 and len(running) == 1,
                   [f"{c['Name'].lstrip('/')} {c['State']['Status']} {c['Config']['Image']}" for c in s["inspect"]] or "no canary container")
    return running[0] if ok else None


def check_exposure(run, can, s, c):
    """The port is bound no wider than its exposure: Docker's bindings, the live sockets, the network."""
    declared = {(e["bind"], e["port"]) for e in can["exposures"].values()}
    bindings = {(b["HostIp"], int(b["HostPort"])) for bs in (c["HostConfig"]["PortBindings"] or {}).values() for b in bs}
    run.check("exposure: docker port bindings", bindings == declared, f"declared {sorted(declared)}, bound {sorted(bindings)}")
    live = hl.listeners(s.get("ss", ""))
    for name, e in can["exposures"].items():
        on_port = sorted({a for a, p in live if p == e["port"]})
        run.check(f"exposure: {name} socket", on_port == [e["bind"]],
                  f"port {e['port']} must listen only on {e['bind']}, listens on {on_port or 'nothing'}")
    tunnel, lan = can["exposures"]["tunnel"]["port"], can["exposures"]["lan"]["port"]
    for host, port, why in ((can["lan_ip"], tunnel, "tunnel port from the LAN"),
                            (can["ts_ip"], tunnel, "tunnel port over Tailscale"),
                            (can["ts_ip"], lan, "LAN port over Tailscale IP")):
        rc, code, _, _ = run.curl(f"http://{host}:{port}/", f"refused-{host}-{port}", ("-m", "4"))
        run.check(f"exposure: {why} refused", rc != 0 and code in ("000", ""), f"http://{host}:{port}/ -> curl exit {rc}, http {code or '000'}")


def probe_server(run, can, c):
    hostname = c["Config"]["Hostname"]
    for name, e in can["exposures"].items():
        path = f"/probe-{run.state['run_id']}-{run.label}-local-{name}"
        _, out, _ = run.ssh(can["server"], f"curl -s -m5 -w '\\n%{{http_code}}' http://{e['bind']}:{e['port']}{path}")
        body, _, code = out.rpartition("\n")
        (run.phase_dir / "bodies" / f"local-{name}.txt").write_text(out)
        run.check(f"path: server-local {name} {e['bind']}:{e['port']}", code == "200" and body_from(body, hostname, path),
                  f"http {code}, body {'from this container' if body_from(body, hostname, path) else 'NOT from this container'}")
    return hostname


def probe_lan(run, can, hostname):
    e = can["exposures"]["lan"]
    path = f"/probe-{run.state['run_id']}-{run.label}-lan"
    rc, code, _, body = run.curl(f"http://{e['bind']}:{e['port']}{path}", "lan")
    run.check("path: LAN direct from laptop", code == "200" and body_from(body, hostname, path),
              f"http://{e['bind']}:{e['port']}{path} -> {code}, {'from this container' if body_from(body, hostname, path) else 'not from this container'}")
    return path


def poll(fn, seconds):
    deadline = time.time() + seconds
    while True:
        ok, detail = fn()
        if ok or time.time() > deadline:
            return ok, detail
        time.sleep(10)


def check_traefik(run, can, hostname):
    current, _, _ = traefik_state(run)
    dyn = yaml.safe_load(current) or {}
    router = dyn.get("http", {}).get("routers", {}).get(can["app"], {})
    urls = [s.get("url") for s in dyn.get("http", {}).get("services", {}).get(router.get("service", ""), {}).get("loadBalancer", {}).get("servers", [])]
    lan = can["exposures"]["lan"]
    want = f"http://{lan['bind']}:{lan['port']}"
    run.check("traefik: route in dynamic.yml",
              router.get("rule") == f"Host(`{can['lan_hostname']}`)" and router.get("entryPoints") == ["websecure"]
              and router.get("tls", {}).get("certResolver") == "cloudflare" and urls == [want],
              f"rule {router.get('rule')}, entryPoints {router.get('entryPoints')}, tls {router.get('tls')}, servers {urls} (want {want})")
    path = f"/probe-{run.state['run_id']}-{run.label}-traefik"

    def attempt():
        rc, code, ssl, body = run.curl(f"https://{can['lan_hostname']}{path}", "traefik")
        via = f"X-Forwarded-Host: {can['lan_hostname']}" in body
        return (code == "200" and ssl == "0" and via and body_from(body, hostname, path),
                f"https://{can['lan_hostname']}{path} -> {code or 'curl exit ' + str(rc)}, ssl_verify={ssl}, via Traefik {via}, from this container {body_from(body, hostname, path)}")
    run.check("path: Traefik HTTPS", *poll(attempt, 150))
    rc, code, ssl, _ = run.curl(can["regression_url"], "traefik-regression")
    run.check("traefik: existing route still answers", code in ("200", "302") and ssl == "0", f"{can['regression_url']} -> {code}, ssl_verify={ssl}")
    return path


def check_tunnel(run, can, s, hostname):
    routes = [i for i in s["tunnel_ingress"] if i["hostname"] == can["tunnel_hostname"]]
    want = f"http://127.0.0.1:{can['exposures']['tunnel']['port']}"
    run.check("tunnel: ingress route", [r["service"] for r in routes] == [want],
              f"{can['tunnel_hostname']} -> {[r['service'] for r in routes] or 'no route'} (want {want})")
    path = f"/probe-{run.state['run_id']}-{run.label}-tunnel"

    def attempt():
        rc, code, _, body = run.curl(f"https://{can['tunnel_hostname']}{path}", "tunnel")
        via = "Cf-Ray:" in body and f"Host: {can['tunnel_hostname']}" in body
        return (code == "200" and via and body_from(body, hostname, path),
                f"https://{can['tunnel_hostname']}{path} -> {code or 'curl exit ' + str(rc)}, via Cloudflare {via}, from this container {body_from(body, hostname, path)}")
    run.check("path: Cloudflare tunnel", *poll(attempt, 180))
    return path


def check_logs(run, can, paths):
    s = remote_state(run, can)
    logs = s.get("logs", "")
    missing = [p for p in paths if p not in logs]
    run.check("logs: every probe reached the container", not missing, f"missing {missing}" if missing else f"{len(paths)} probe paths in docker logs")
    bad = [l for l in logs.splitlines() if re.search(r"\b(panic|fatal|error)\b", l, re.I)]
    run.check("logs: no errors", not bad, bad[:3] or "none")


def check_health(run, can):
    e = can["exposures"]["tunnel"]
    _, out, _ = run.ssh(can["server"], f"curl -s -o /dev/null -m5 -w '%{{http_code}}' http://{e['bind']}:{e['port']}/health")
    run.check("app health /health", out.strip() == "200", f"GET /health -> {out.strip() or 'no answer'}")


def check_version(run, can, s, c, phase):
    running = c["Image"]
    tag_id = lambda tag: s["images"].get(tag)
    old_ref, new_ref = f"{can['image']}:{can['tag_old']}", f"{can['image']}:{can['tag_new']}"
    rb = run.state["rollback_tag"]
    if phase in ("deployed", "exposed"):
        ok = run.check("version: old tag", c["Config"]["Image"] == old_ref and running == tag_id(old_ref),
                       f"container {c['Config']['Image']} {running[:19]}, {old_ref} is {str(tag_id(old_ref))[:19]}")
        if ok:
            run.state["old_image_id"] = running
    elif phase == "updated":
        old = run.state.get("old_image_id")
        run.check("version: rollback point", tag_id(rb) == old and old, f"{rb} is {str(tag_id(rb))[:19]}, deployed image {str(old)[:19]}")
        ok = run.check("version: new tag", c["Config"]["Image"] == new_ref and running != old and running == tag_id(new_ref),
                       f"container {c['Config']['Image']} {running[:19]}, old {str(old)[:19]}")
        if ok:
            run.state["new_image_id"] = running
    elif phase == "rolled-back":
        old = run.state.get("old_image_id")
        run.check("version: rolled back", running == old and tag_id(rb) == old,
                  f"container {c['Config']['Image']} runs {running[:19]}, deployed image {str(old)[:19]}, {rb} {str(tag_id(rb))[:19]}")


def drive_phase(phase, run):
    can = run.state["canary"]
    s = remote_state(run, can)
    if phase == "deployed":
        check_rules(run, can, s)
    c = check_container(run, can, s)
    if c is None:
        return run.finish()
    check_exposure(run, can, s, c)
    hostname = probe_server(run, can, c)
    paths = [f"/probe-{run.state['run_id']}-{run.label}-local-{n}" for n in can["exposures"]]
    paths.append(probe_lan(run, can, hostname))
    if phase != "deployed":
        paths.append(check_traefik(run, can, hostname))
        paths.append(check_tunnel(run, can, s, hostname))
    check_health(run, can)
    check_logs(run, can, paths)
    check_version(run, can, s, c, phase)
    run.finish()


def cleaned(run):
    can = run.state["canary"]
    s = remote_state(run, can)
    run.check("cleanup: no canary container", not s["inspect"], [c["Name"] for c in s["inspect"]] or "none")
    run.check("cleanup: no stack folder", s.get("dir") == "absent", f"~/stacks/{can['app']} {s.get('dir')}")
    before = set(run.state.get("canary_images_before", []))
    left = [f"{k} {v[:19]}" for k, v in s["image_list"] if k.startswith((can["image"] + ":", can["app"] + "-rollback:")) and f"{k} {v}" not in before]
    dangling = [v for k, v in s["image_list"] if v in (run.state.get("old_image_id"), run.state.get("new_image_id"))]
    run.check("cleanup: no canary images", not left and not dangling, left + [f"untagged {d[:19]}" for d in dangling] or "none")
    ports = [e["port"] for e in can["exposures"].values()]
    still = [f"{a}:{p}" for a, p in hl.listeners(s.get("ss", "")) if p in ports]
    run.check("cleanup: canary ports closed", not still, still or f"nothing on {ports}")
    run.check("cleanup: no tunnel route", not any(i["hostname"] == can["tunnel_hostname"] for i in s["tunnel_ingress"]),
              [i["hostname"] for i in s["tunnel_ingress"]])
    current, head, backups = traefik_state(run)
    run.check("cleanup: dynamic.yml back to git HEAD", current == head and can["app"] not in current,
              "matches HEAD" if current == head else "differs from HEAD")
    run.check("cleanup: no dynamic.yml backups", not backups, backups or "none")
    run.check("cleanup: ~/stacks has no canary paths", not s.get("git"), s.get("git") or "none")
    for url, name in ((f"http://{can['lan_ip']}:{can['exposures']['lan']['port']}/", "lan"),
                      (f"https://{can['lan_hostname']}/", "traefik"), (f"https://{can['tunnel_hostname']}/", "tunnel")):
        rc, code, _, body = run.curl(url, f"gone-{name}", ("-m", "6"))
        run.check(f"cleanup: {name} path gone", "Hostname:" not in body, f"{url} -> {code or 'curl exit ' + str(rc)}, whoami body {'PRESENT' if 'Hostname:' in body else 'absent'}")
    # dagdappshub.com has a wildcard record, so the name keeps resolving after cleanup. A leftover
    # CNAME to the tunnel answers the tunnel's catch-all 404; a removed one answers like any unused name.
    sibling = f"https://unused-{run.state['run_id']}.{can['tunnel_hostname'].split('.', 1)[1]}/"
    _, canary_code, _, _ = run.curl(f"https://{can['tunnel_hostname']}/", "dns-canary", ("-m", "25"))
    _, sibling_code, _, _ = run.curl(sibling, "dns-sibling", ("-m", "25"))
    same = canary_code == sibling_code or (canary_code.startswith("52") and sibling_code.startswith("52"))
    run.check("cleanup: tunnel DNS record gone", same,
              f"{can['tunnel_hostname']} -> {canary_code}, unused sibling {sibling} -> {sibling_code}"
              + ("" if same else ": the CNAME to the tunnel is still there, delete it in Cloudflare DNS"))
    earlier = {p: (run.dir / p / "checks.jsonl").exists() for p in PHASES[:-1]}
    run.check("evidence kept", all(earlier.values()), {p: "kept" if v else "MISSING" for p, v in earlier.items()})
    run.finish()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("phase", choices=("start",) + PHASES)
    ap.add_argument("--run", help="run ID (default: latest)")
    ap.add_argument("--tag", help="store this check under <phase>-<tag>, e.g. a deliberate failure, without overwriting the phase's own evidence")
    args = ap.parse_args()
    if args.phase == "start":
        return start()
    run_id = args.run or (hl.RUNS_DIR / "latest").resolve().name
    run = Run(run_id, args.phase, args.tag)
    print(f"run {run_id}, phase {args.phase}")
    cleaned(run) if args.phase == "cleaned" else drive_phase(args.phase, run)


if __name__ == "__main__":
    main()
