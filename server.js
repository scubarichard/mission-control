import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.MC_PORT || "3002", 10);

const BRIDGE_URL = "https://bridge.dakona.net";
const BRIDGE_SECRET = "QuCpV4XodOJMyIP8JQf0dLeQhdeXHtghZ4pcgFFg";
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "cfut_k4BVdir3LOPY4BhWu6ZwPokcegZ2ngLtdu0Y3npt5e624b05";
const CF_ACCOUNT = "974414b2722779257138dc69b656ca2a";
const EVENTS_FILE = join(__dirname, "events.json");
const MAX_EVENTS = 500;

/* ── Event Hub ─────────────────────────────────────────────────────── */

let events = [];
try { events = JSON.parse(readFileSync(EVENTS_FILE, "utf-8")); } catch {}

const sseClients = new Set();

function addEvent(event) {
  const evt = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    agent: event.agent || "unknown",
    action: event.action || "",
    detail: event.detail || "",
    level: event.level || "info",
    ts: event.ts || Date.now(),
  };
  events.push(evt);
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);

  // Persist
  try { writeFileSync(EVENTS_FILE, JSON.stringify(events), "utf-8"); } catch {}

  // Broadcast to SSE clients
  for (const client of sseClients) {
    client.write(`data: ${JSON.stringify(evt)}\n\n`);
  }
  return evt;
}

/* ── Health checks ─────────────────────────────────────────────────── */

async function checkEndpoint(url, timeout = 5000) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status };
  } catch { return { ok: false, status: 0 }; }
}

async function checkBridge() {
  // Check local bridge first (same machine), fall back to tunnel URL
  for (const url of ["http://127.0.0.1:3001/health", `${BRIDGE_URL}/health`]) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) continue;
      const data = await res.json();
      return { status: "live", uptime: data.uptime };
    } catch { continue; }
  }
  return { status: "offline", uptime: 0 };
}

async function checkTunnels() {
  try {
    const headers = { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" };
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/cfd_tunnel?is_deleted=false`, { headers, signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    return data.result.map(t => ({ name: t.name, status: t.status, connections: t.connections?.length || 0 }));
  } catch { return []; }
}

/* ── Express ───────────────────────────────────────────────────────── */

app.use(express.json());
app.use(express.static(__dirname));

// CORS for event hub
app.use("/api/events", (_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/", (_req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

/* ── Event Hub endpoints ───────────────────────────────────────────── */

// POST event (accepts requests from anywhere — events are append-only, low risk)
app.post("/api/events", (req, res) => {
  const evt = addEvent(req.body);
  res.json({ ok: true, event: evt });
});

// Internal event endpoint for agents on the VNet (no Cloudflare Access needed)
app.post("/api/events/internal", (req, res) => {
  const evt = addEvent(req.body);
  res.json({ ok: true, event: evt });
});

// GET events (JSON) — optional ?last=N
app.get("/api/events", (req, res) => {
  const accept = req.headers.accept || "";
  // SSE stream
  if (accept.includes("text/event-stream")) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    // Send recent events as initial burst
    const last = events.slice(-20);
    for (const evt of last) {
      res.write(`data: ${JSON.stringify(evt)}\n\n`);
    }
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }
  // JSON response
  const n = parseInt(req.query.last) || 50;
  res.json(events.slice(-n));
});

/* ── Status endpoint ───────────────────────────────────────────────── */

app.get("/api/status", async (_req, res) => {
  const [bridge, tunnels, n8n, openclaw, dax] = await Promise.all([
    checkBridge(),
    checkTunnels(),
    checkEndpoint("https://n8n.dakona.net"),
    checkEndpoint("https://openclaw.dakona.net"),
    checkEndpoint("https://ca-dax-dakona-pilot.icyplant-88ae76cd.eastus.azurecontainerapps.io"),
  ]);

  res.json({
    ts: Date.now(),
    agents: {
      sonnet: { status: "active", detail: "Claude Sonnet 4.6 via claude.ai" },
      claudeCode: { status: "active", detail: "v2.1.86 / RICHARD-WS" },
      mcpServer: { status: bridge.status === "live" ? "active" : "offline", detail: `Bridge uptime: ${bridge.uptime}s` },
      bridge: { status: bridge.status, uptime: bridge.uptime },
      n8n: { status: n8n.ok ? "active" : "offline", detail: `HTTP ${n8n.status}` },
      vmDaxDev: { status: openclaw.ok ? "active" : "offline", detail: "OpenClaw gateway" },
      dax: { status: dax.ok ? "active" : "offline", detail: `HTTP ${dax.status}` },
      projectAI: { status: openclaw.ok ? "active" : "offline", detail: "GPT-4o / OpenClaw" },
    },
    tunnels,
    openclaw: { reachable: openclaw.ok },
    sseClients: sseClients.size,
    eventCount: events.length,
  });
});

/* ── Sync events from vm-dax-dev event proxy ─────────────────────── */
// n8n SSH tunnel forwards localhost:3003 -> vm-dax-dev:3003
// Cloudflare tunnel: n8n -> desktop
// So we add n8n tunnel for port 3003, then Mission Control polls localhost:3003

let lastProxyPull = 0;
async function syncProxyEvents() {
  try {
    const res = await fetch("https://events.dakona.net/events?last=20", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return;
    const remoteEvents = await res.json();
    if (!Array.isArray(remoteEvents)) return;
    for (const evt of remoteEvents) {
      if (evt.ts > lastProxyPull) addEvent(evt);
    }
    if (remoteEvents.length) lastProxyPull = Math.max(...remoteEvents.map(e => e.ts));
  } catch {}
}

app.listen(PORT, "127.0.0.1", () => {
  console.log(`DAX Mission Control listening on http://127.0.0.1:${PORT}`);
  console.log(`Event Hub: POST /api/events | GET /api/events (JSON or SSE)`);
  // Sync remote events every 15 seconds
  setInterval(syncProxyEvents, 15000);
  syncProxyEvents();
});
