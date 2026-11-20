"""Shared helpers for doctor.py and verify.py: the Servers table, SSH, the canary and evidence."""

import datetime
import json
import os
import re
import subprocess
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = SKILL_DIR.parent.parent.parent
DEPLOY_SKILL = REPO_ROOT / "skills" / "homelab-deploy" / "SKILL.md"
CANARY_FILE = SKILL_DIR / "canary.json"
STATE_ROOT = Path(os.environ.get("XDG_STATE_HOME", Path.home() / ".local" / "state")) / "verify-homelab"
RUNS_DIR = STATE_ROOT / "runs"
SERVERS = ("svc-01", "svc-02")
TRAEFIK_SERVER = "svc-01"


def servers_table(path=DEPLOY_SKILL):
    """Return {row label: {server: cell}} from the Servers table in homelab-deploy's SKILL.md."""
    lines = Path(path).read_text().splitlines()
    start = next(i for i, l in enumerate(lines) if re.match(r"^\|\s*\|\s*svc-0", l))
    header = [c.strip() for c in lines[start].strip().strip("|").split("|")]
    rows = {}
    for line in lines[start + 2:]:
        if not line.startswith("|"):
            break
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        rows[cells[0].replace("`", "")] = dict(zip(header[1:], cells[1:]))
    return rows


def expected(server, table=None):
    """The facts the Servers table promises for one server."""
    t = table or servers_table()
    lan, ts = [p.strip() for p in t["LAN IP / Tailscale"][server].split("/")]
    hw = re.match(r"(i\d), (\d+) cores, ([\d.]+) GB RAM, (\d+) GB \*\*(SSD|HDD)\*\*", t["Hardware"][server])
    if not hw:
        raise SystemExit(f"Servers table: cannot parse Hardware cell for {server}: {t['Hardware'][server]!r}")
    stacks_cell = t["Stacks in ~/stacks"][server]
    services_cell = t["Host services"][server]
    subnet = re.search(r"subnet router `([^`]+)`", services_cell)
    return {
        "lan_ip": lan,
        "ts_ip": ts,
        "cpu": hw.group(1),
        "cores": int(hw.group(2)),
        "ram_gb": float(hw.group(3)),
        "disk_gb": int(hw.group(4)),
        "disk_kind": hw.group(5),
        "stacks": sorted(re.findall(r"`([a-z0-9][a-z0-9_-]*)`", stacks_cell)),
        "subnet_routes": [subnet.group(1)] if subnet else [],
        "cloudflared": "cloudflared" in services_cell,
        "open_ports": sorted(int(p) for p in re.findall(r"`(\d+)`", t["Listens beyond localhost"][server])),
    }


def ssh(host, command, stdin=None, timeout=60):
    """Run a command on a server through its SSH alias. Returns (exit code, stdout, stderr)."""
    try:
        p = subprocess.run(
            ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=8", host, command],
            input=stdin, capture_output=True, text=True, timeout=timeout,
        )
        return p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired:
        return 124, "", f"ssh {host}: timed out after {timeout}s"


def sections(text):
    """Split remote output written as '### name' blocks into {name: body}."""
    out, name = {}, None
    for line in text.splitlines():
        if line.startswith("### "):
            name = line[4:].strip()
            out[name] = []
        elif name:
            out[name].append(line)
    return {k: "\n".join(v).strip() for k, v in out.items()}


def listeners(ss_output):
    """Parse `ss -tlnH` into [(address, port)], address without brackets or %iface scope kept as-is."""
    result = []
    for line in ss_output.splitlines():
        cols = line.split()
        if len(cols) < 4:
            continue
        addr, _, port = cols[3].rpartition(":")
        result.append((addr.strip("[]"), int(port)))
    return result


def is_loopback(addr):
    return addr.startswith("127.") or addr in ("::1",) or addr.endswith("%lo")


def is_wildcard(addr):
    return addr in ("0.0.0.0", "*", "::", "")


def canary():
    """The canary's fixed parameters, with the LAN bind resolved from the Servers table."""
    c = json.loads(CANARY_FILE.read_text())
    exp = expected(c["server"])
    c["lan_ip"], c["ts_ip"] = exp["lan_ip"], exp["ts_ip"]
    for e in c["exposures"].values():
        if e["bind"] == "lan-ip":
            e["bind"] = exp["lan_ip"]
    return c


def today():
    return datetime.date.today().strftime("%Y%m%d")


def now():
    return datetime.datetime.now().astimezone().isoformat(timespec="seconds")


def die(msg):
    print(msg, file=sys.stderr)
    raise SystemExit(2)
