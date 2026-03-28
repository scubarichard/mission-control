import "dotenv/config";
import express from "express";
import { execSync } from "node:child_process";
import {
  readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync,
} from "node:fs";
import { appendFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

/* ── Config ─────────────────────────────────────────────────────────── */

const PORT        = parseInt(process.env.BRIDGE_PORT || "3001", 10);
const SECRET      = process.env.BRIDGE_SECRET || "";
const BASE_PATH   = resolve(process.env.BRIDGE_BASE_PATH || "P:/_clients/dakona");
const LOG_FILE    = process.env.BRIDGE_LOG || "bridge.log";

/* ── Logging ────────────────────────────────────────────────────────── */

async function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { await appendFile(LOG_FILE, line + "\n"); } catch {}
}

/* ── Path safety ────────────────────────────────────────────────────── */

function safePath(relPath) {
  const abs = resolve(join(BASE_PATH, relPath));
  if (!abs.startsWith(BASE_PATH)) {
    throw new Error(`Path traversal blocked: ${relPath}`);
  }
  return abs;
}

/* ── Express app ────────────────────────────────────────────────────── */

const app = express();
app.use(express.json({ limit: "10mb" }));

// Request logging
app.use((req, _res, next) => {
  log(`${req.method} ${req.path} from ${req.ip}`);
  next();
});

// Auth — check X-Bridge-Secret on all routes except /health
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (SECRET && req.headers["x-bridge-secret"] !== SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

/* ── Routes ─────────────────────────────────────────────────────────── */

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    basePath: BASE_PATH,
    uptime: Math.floor(process.uptime()),
  });
});

// ── run_powershell ──────────────────────────────────────────────────
app.post("/execute/run_powershell", async (req, res) => {
  const { command, timeout = 120_000 } = req.body;
  if (!command) return res.status(400).json({ error: "command is required" });

  const tmpFile = join(tmpdir(), `bridge-ps-${randomBytes(6).toString("hex")}.ps1`);
  try {
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    writeFileSync(tmpFile, Buffer.concat([bom, Buffer.from(command, "utf-8")]));
    const output = execSync(
      `powershell.exe -NoProfile -NonInteractive -File "${tmpFile}"`,
      { cwd: BASE_PATH, timeout, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );
    res.json({ output: output || "(no output)" });
  } catch (err) {
    const parts = [];
    if (err.stdout) parts.push(err.stdout);
    if (err.stderr) parts.push(err.stderr);
    if (!parts.length) parts.push(err.message);
    res.json({ output: `ERROR: ${parts.join("\n")}` });
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
});

// ── read_file ───────────────────────────────────────────────────────
app.post("/execute/read_file", (req, res) => {
  const { path: relPath } = req.body;
  if (!relPath) return res.status(400).json({ error: "path is required" });
  try {
    const content = readFileSync(safePath(relPath), "utf-8");
    res.json({ content });
  } catch (err) {
    res.json({ content: `ERROR: ${err.message}` });
  }
});

// ── write_file ──────────────────────────────────────────────────────
app.post("/execute/write_file", (req, res) => {
  const { path: relPath, content } = req.body;
  if (!relPath) return res.status(400).json({ error: "path is required" });
  if (content === undefined) return res.status(400).json({ error: "content is required" });
  try {
    const abs = safePath(relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf-8");
    res.json({ output: `Wrote ${abs}` });
  } catch (err) {
    res.json({ output: `ERROR: ${err.message}` });
  }
});

// ── list_files ──────────────────────────────────────────────────────
app.post("/execute/list_files", (req, res) => {
  const { path: relPath = ".", depth = 2 } = req.body;
  try {
    const abs = safePath(relPath);
    const tree = [];

    function walk(dir, prefix, currentDepth) {
      if (currentDepth > depth) return;
      const entries = readdirSync(dir);
      for (const name of entries) {
        try {
          const full = join(dir, name);
          const s = statSync(full);
          const marker = s.isDirectory() ? "d" : "-";
          tree.push(`${prefix}${marker}  ${name}`);
          if (s.isDirectory() && currentDepth < depth) {
            walk(full, prefix + "  ", currentDepth + 1);
          }
        } catch {}
      }
    }

    walk(abs, "", 1);
    res.json({ output: tree.join("\n") || "(empty)" });
  } catch (err) {
    res.json({ output: `ERROR: ${err.message}` });
  }
});

// ── run_claude_code ─────────────────────────────────────────────────
app.post("/execute/run_claude_code", async (req, res) => {
  const { prompt, cwd, timeout = 300_000 } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  const workDir = cwd ? safePath(cwd) : BASE_PATH;
  const tmpFile = join(tmpdir(), `bridge-cc-${randomBytes(6).toString("hex")}.txt`);
  try {
    writeFileSync(tmpFile, prompt, "utf-8");
    const output = execSync(
      `"C:\\Windows\\System32\\config\\systemprofile\\AppData\\Roaming\\npm\\claude.cmd" -p "${tmpFile}" --output-format text`,
      { cwd: workDir, timeout, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], shell: "C:\\Windows\\System32\\cmd.exe", env: { ...process.env, PATH: (process.env.PATH || "") + ";C:\\Windows\\System32\\config\\systemprofile\\AppData\\Roaming\\npm" } },
    );
    res.json({ output: output || "(no output)" });
  } catch (err) {
    const parts = [];
    if (err.stdout) parts.push(err.stdout);
    if (err.stderr) parts.push(err.stderr);
    if (!parts.length) parts.push(err.message);
    res.json({ output: `ERROR: ${parts.join("\n")}` });
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
});

/* ── Start ──────────────────────────────────────────────────────────── */

app.listen(PORT, "127.0.0.1", () => {
  log(`DAX Desktop Bridge listening on http://127.0.0.1:${PORT}`);
  log(`Base path: ${BASE_PATH}`);
  log(`Auth: ${SECRET ? "enabled" : "DISABLED (no BRIDGE_SECRET set)"}`);
});
