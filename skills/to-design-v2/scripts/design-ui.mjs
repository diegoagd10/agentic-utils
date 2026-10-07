#!/usr/bin/env node
// Local review server for /to-design-v2. Zero dependencies.
//
//   design-ui open  <design.html>               start server, open browser
//   design-ui wait  <design.html> [--timeout s] block until the user sends
//   design-ui close <design.html> [--message m] end the session
//   design-ui serve <design.html>               the server itself (internal)

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SDK_PATH = path.join(HERE, "..", "assets", "sdk.js");
const SESSIONS_DIR = path.join(os.tmpdir(), "to-design-v2-sessions");
const DEFAULT_WAIT_S = 540;
const IDLE_MS = 30 * 60 * 1000;

const [command, target, ...rest] = process.argv.slice(2);

if (!command || !target) {
  fail("usage: design-ui <open|wait|close|serve> <design.html> [options]");
}

const file = path.resolve(target);
const sessionFile = path.join(
  SESSIONS_DIR,
  createHash("sha1").update(file).digest("hex").slice(0, 12) + ".json",
);

switch (command) {
  case "open":
    await open();
    break;
  case "wait":
    await wait();
    break;
  case "close":
    await close();
    break;
  case "serve":
    serve();
    break;
  default:
    fail(`unknown command: ${command}`);
}

// ---------------------------------------------------------------- CLI

async function open() {
  if (!fs.existsSync(file)) fail(`no such file: ${file}`);

  const running = await findServer();
  if (running) {
    print({ status: "open", url: running.url, reused: true });
    return;
  }

  const child = spawn(
    process.execPath,
    [fileURLToPath(import.meta.url), "serve", file],
    { detached: true, stdio: "ignore" },
  );
  child.unref();

  const started = await poll(findServer, 5000);
  if (!started) fail("server did not start");
  openBrowser(started.url);
  print({ status: "open", url: started.url, reused: false });
}

async function wait() {
  const server = await findServer();
  if (!server) {
    print({ status: "no_server", next: "run `design-ui open` again" });
    process.exit(1);
  }
  const seconds = Number(flag("--timeout") ?? DEFAULT_WAIT_S);
  const res = await fetch(`${server.url}/__wait?timeout=${seconds}`, {
    signal: AbortSignal.timeout((seconds + 30) * 1000),
  });
  const body = await res.text();
  process.stdout.write(body + "\n");
  // Until acked, the next wait redelivers it, so a killed wait loses nothing.
  const { id } = JSON.parse(body);
  if (id) {
    await fetch(`${server.url}/__ack`, {
      method: "POST",
      body: JSON.stringify({ id }),
    });
  }
}

async function close() {
  const server = await findServer();
  if (!server) {
    print({ status: "closed" });
    return;
  }
  const message = flag("--message") ?? "";
  await fetch(`${server.url}/__end`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
  print({ status: "closed" });
}

async function findServer() {
  let info;
  try {
    info = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
  } catch {
    return null;
  }
  try {
    const res = await fetch(`${info.url}/__version`, {
      signal: AbortSignal.timeout(1000),
    });
    const body = await res.json();
    return body.file === file && !body.ended ? info : null;
  } catch {
    return null;
  }
}

function openBrowser(url) {
  const [cmd, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  spawn(cmd, args, { detached: true, stdio: "ignore" })
    .on("error", () => {})
    .unref();
}

async function poll(fn, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

function flag(name) {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
}

function print(value) {
  process.stdout.write(JSON.stringify(value) + "\n");
}

function fail(message) {
  process.stderr.write(message + "\n");
  process.exit(2);
}

// ------------------------------------------------------------- server

function serve() {
  const queue = [];
  const waiters = new Set();
  let inflight = null;
  let nextId = 1;
  let ended = null;
  // Only the agent and sent feedback count: an open tab alone polls forever.
  let lastActive = Date.now();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (req.method === "GET" && url.pathname === "/") {
      return send(res, 200, "text/html; charset=utf-8", page());
    }
    if (req.method === "GET" && url.pathname === "/__sdk.js") {
      const sdk = fs.readFileSync(SDK_PATH, "utf8");
      return send(res, 200, "text/javascript; charset=utf-8", sdk);
    }
    if (req.method === "GET" && url.pathname === "/__version") {
      return json(res, {
        file,
        mtime: mtime(),
        listening: waiters.size > 0,
        ended,
      });
    }
    if (req.method === "POST" && url.pathname === "/__feedback") {
      if (ended) return json(res, { error: "session ended" }, 409);
      lastActive = Date.now();
      queue.push({ id: nextId++, ...(await readJson(req)) });
      flush();
      return json(res, { ok: true });
    }
    if (req.method === "GET" && url.pathname === "/__wait") {
      lastActive = Date.now();
      const seconds = Number(url.searchParams.get("timeout"));
      return hold(res, (seconds > 0 ? seconds : DEFAULT_WAIT_S) * 1000);
    }
    if (req.method === "POST" && url.pathname === "/__ack") {
      const { id } = await readJson(req);
      if (inflight?.id === id) inflight = null;
      return json(res, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/__end") {
      ended = { message: (await readJson(req)).message ?? "" };
      for (const w of waiters) w.done({ status: "ended" });
      // Give open tabs a few polls to see the end before exiting.
      setTimeout(shutdown, 5000);
      return json(res, { ok: true });
    }
    send(res, 404, "text/plain", "not found");
  });

  function hold(res, waitMs) {
    if (inflight || queue.length) return json(res, deliver());
    const waiter = {
      done(body) {
        clearTimeout(waiter.timer);
        waiters.delete(waiter);
        json(res, body);
      },
    };
    waiter.timer = setTimeout(
      () => waiter.done({ status: "timeout", next: "run wait again" }),
      waitMs,
    );
    res.on("close", () => {
      clearTimeout(waiter.timer);
      waiters.delete(waiter);
    });
    waiters.add(waiter);
  }

  function flush() {
    const [waiter] = waiters;
    if (waiter && (inflight || queue.length)) waiter.done(deliver());
  }

  function deliver() {
    inflight ??= queue.shift();
    return { status: "feedback", ...inflight };
  }

  function page() {
    const html = fs.readFileSync(file, "utf8");
    const tag =
      `<script>window.__DUI_MTIME__ = ${mtime()};</script>\n` +
      '<script src="/__sdk.js" defer></script>';
    return html.includes("</body>")
      ? html.replace("</body>", `${tag}\n</body>`)
      : html + tag;
  }

  function mtime() {
    try {
      return fs.statSync(file).mtimeMs;
    } catch {
      return 0;
    }
  }

  function shutdown() {
    try {
      fs.rmSync(sessionFile);
    } catch {}
    process.exit(0);
  }

  setInterval(() => {
    if (!waiters.size && Date.now() - lastActive > IDLE_MS) shutdown();
  }, 60_000).unref();

  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    fs.writeFileSync(
      sessionFile,
      JSON.stringify({ url: `http://127.0.0.1:${port}`, pid: process.pid }),
    );
  });
}

function send(res, status, type, body) {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}

function json(res, body, status = 200) {
  send(res, status, "application/json", JSON.stringify(body));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}
