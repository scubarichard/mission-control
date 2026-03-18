import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

const REPO = process.env.DAX_REPO_PATH || "P:/_clients/dakona/dax";
const AZURE_SUB = process.env.AZURE_SUBSCRIPTION || "";
const AZURE_RG = process.env.AZURE_RG || "rg-dax-dakona-pilot";
const AZURE_CA = process.env.AZURE_CONTAINER_APP || "ca-dax-dakona-pilot";
const N8N_URL = process.env.N8N_URL || "https://n8n.dakona.net";
const N8N_API_KEY = process.env.N8N_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4";

function run(cmd, { timeout = 120_000, cwd = REPO } = {}) {
  try {
    return execSync(cmd, {
      cwd, timeout, encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });
  } catch (err) {
    const parts = [];
    if (err.stdout) parts.push(err.stdout);
    if (err.stderr) parts.push(err.stderr);
    if (parts.length === 0) parts.push(err.message);
    return `ERROR: ${parts.join("\n")}`;
  }
}

// Write script to a temp .ps1 file and execute with -File — completely avoids all quoting issues
function runPowerShell(script, { timeout = 120_000, cwd = REPO } = {}) {
  const tmpFile = join(tmpdir(), `dax-ps-${randomBytes(6).toString("hex")}.ps1`);
  try {
    // Write script as UTF-8 with BOM so PowerShell reads it correctly
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    const content = Buffer.concat([bom, Buffer.from(script, "utf-8")]);
    writeFileSync(tmpFile, content);
    const out = execSync(`powershell.exe -NoProfile -NonInteractive -File "${tmpFile}"`, {
      cwd, timeout, encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return out || "(no output)";
  } catch (err) {
    const parts = [];
    if (err.stdout) parts.push(err.stdout);
    if (err.stderr) parts.push(err.stderr);
    if (parts.length === 0) parts.push(err.message);
    return `ERROR: ${parts.join("\n")}`;
  } finally {
    try { require("node:fs").unlinkSync(tmpFile); } catch {}
  }
}

function resolvePath(relPath) {
  const resolved = resolve(join(REPO, relPath));
  if (!resolved.startsWith(resolve(REPO))) throw new Error("Path traversal outside the repo is not allowed");
  return resolved;
}

const server = new McpServer({ name: "dax-dev", version: "1.0.0" });

server.tool("read_file", "Read any file in the DAX repo by relative path",
  { path: z.string() },
  async ({ path }) => {
    try {
      const content = readFileSync(resolvePath(path), "utf-8");
      return { content: [{ type: "text", text: content }] };
    } catch (err) {
      return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
    }
  }
);

server.tool("write_file", "Write or update a file in the DAX repo, creating directories as needed",
  { path: z.string(), content: z.string() },
  async ({ path, content }) => {
    try {
      const abs = resolvePath(path);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, "utf-8");
      return { content: [{ type: "text", text: `Wrote ${abs}` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
    }
  }
);

server.tool("run_powershell", "Execute any PowerShell script — supports multi-line, hashtables, try/catch, here-strings, az CLI, everything. No escaping needed.",
  { command: z.string() },
  async ({ command }) => {
    const out = runPowerShell(command);
    return { content: [{ type: "text", text: out }] };
  }
);

server.tool("git_status", "Show the current git status of the DAX repo", {},
  async () => ({ content: [{ type: "text", text: run("git status") }] })
);

server.tool("git_commit_push", "Stage all changes, commit with the given message, and push to the remote",
  { message: z.string() },
  async ({ message }) => {
    try {
      run("git add -A");
      const commitOut = runPowerShell(`git commit -m @"\n${message}\n"@`);
      const pushOut = run("git push");
      const hash = run("git rev-parse --short HEAD").trim();
      return { content: [{ type: "text", text: `Committed and pushed: ${hash}\n\n${commitOut}\n${pushOut}` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
    }
  }
);

server.tool("azure_container_logs", "Fetch recent logs from the DAX Azure Container App",
  { tail: z.number().optional().default(50), filter: z.string().optional() },
  async ({ tail, filter }) => {
    const sub = AZURE_SUB ? `--subscription "${AZURE_SUB}"` : "";
    let out = runPowerShell(`az containerapp logs show -n ${AZURE_CA} -g ${AZURE_RG} ${sub} --tail ${tail} --type console 2>&1`);
    if (filter) out = out.split("\n").filter(l => l.toLowerCase().includes(filter.toLowerCase())).join("\n") || `No lines matched: ${filter}`;
    return { content: [{ type: "text", text: out }] };
  }
);

server.tool("azure_revision", "List active revisions of the DAX Azure Container App", {},
  async () => {
    const sub = AZURE_SUB ? `--subscription "${AZURE_SUB}"` : "";
    return { content: [{ type: "text", text: runPowerShell(`az containerapp revision list -n ${AZURE_CA} -g ${AZURE_RG} ${sub} -o table 2>&1`) }] };
  }
);

server.tool("deploy_sso_config", "Run Deploy-SSOConfig.ps1 for the dakona-pilot client", {},
  async () => {
    const script = join(REPO, "scripts", "Deploy-SSOConfig.ps1");
    return { content: [{ type: "text", text: runPowerShell(`& "${script}" -ClientName "dakona-pilot" -ClientTenantId "d2a3c346-00f3-47dd-a53e-caa3fca74714" -LibreChatUrl "https://dax.dakona.com"`, { timeout: 180_000 }) }] };
  }
);

server.tool("n8n_list_workflows", "List all workflows from the n8n instance",
  { n8nUrl: z.string().optional() },
  async ({ n8nUrl }) => {
    const base = n8nUrl || N8N_URL;
    const url = `${base.replace(/\/+$/, "")}/api/v1/workflows?limit=50`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json", "X-N8N-API-KEY": N8N_API_KEY } });
      if (!res.ok) return { content: [{ type: "text", text: `ERROR: ${res.status} ${res.statusText}` }], isError: true };
      const body = await res.json();
      const workflows = (body.data || body).map(w => ({ id: w.id, name: w.name, active: w.active }));
      return { content: [{ type: "text", text: JSON.stringify(workflows, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
    }
  }
);

server.tool("n8n_get_workflow", "Get full details of a specific n8n workflow by ID",
  { workflowId: z.string() },
  async ({ workflowId }) => {
    const url = `${N8N_URL}/api/v1/workflows/${workflowId}`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json", "X-N8N-API-KEY": N8N_API_KEY } });
      if (!res.ok) return { content: [{ type: "text", text: `ERROR: ${res.status} ${res.statusText}` }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(await res.json(), null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
    }
  }
);

server.tool("n8n_create_workflow", "Create a new n8n workflow",
  { workflow: z.record(z.any()) },
  async ({ workflow }) => {
    try {
      const res = await fetch(`${N8N_URL}/api/v1/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-N8N-API-KEY": N8N_API_KEY },
        body: JSON.stringify(workflow),
      });
      const body = await res.json();
      if (!res.ok) return { content: [{ type: "text", text: `ERROR: ${res.status} - ${JSON.stringify(body)}` }], isError: true };
      return { content: [{ type: "text", text: `Created: ${body.id} — ${body.name}` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
    }
  }
);

server.tool("n8n_update_workflow", "Update an existing n8n workflow by ID",
  { workflowId: z.string(), workflow: z.record(z.any()) },
  async ({ workflowId, workflow }) => {
    try {
      const res = await fetch(`${N8N_URL}/api/v1/workflows/${workflowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-N8N-API-KEY": N8N_API_KEY },
        body: JSON.stringify(workflow),
      });
      const body = await res.json();
      if (!res.ok) return { content: [{ type: "text", text: `ERROR: ${res.status} - ${JSON.stringify(body)}` }], isError: true };
      return { content: [{ type: "text", text: `Updated: ${workflowId}` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
    }
  }
);

server.tool("n8n_activate_workflow", "Activate or deactivate an n8n workflow",
  { workflowId: z.string(), active: z.boolean() },
  async ({ workflowId, active }) => {
    try {
      const res = await fetch(`${N8N_URL}/api/v1/workflows/${workflowId}/${active ? "activate" : "deactivate"}`, {
        method: "POST",
        headers: { "X-N8N-API-KEY": N8N_API_KEY },
      });
      const body = await res.json();
      if (!res.ok) return { content: [{ type: "text", text: `ERROR: ${res.status} - ${JSON.stringify(body)}` }], isError: true };
      return { content: [{ type: "text", text: `Workflow ${workflowId} ${active ? "activated" : "deactivated"}` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
    }
  }
);

server.tool("cosmos_query", "Query a Cosmos DB (MongoDB API) collection.",
  { collection: z.string(), query: z.record(z.any()), limit: z.number().optional().default(10) },
  async ({ collection, query, limit }) => {
    let mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      mongoUri = runPowerShell(`az keyvault secret show --vault-name kvdaxdakonapilot --name cosmos-connection-string --query value -o tsv`).trim();
      if (mongoUri.startsWith("ERROR")) return { content: [{ type: "text", text: "ERROR: Could not retrieve MONGO_URI. " + mongoUri }], isError: true };
    }
    const script = `mongosh "${mongoUri}" --quiet --eval "db.getCollection('${collection}').find(${JSON.stringify(query)}).limit(${limit}).toArray()"`;
    return { content: [{ type: "text", text: runPowerShell(script, { timeout: 30_000 }) }] };
  }
);

process.on("uncaughtException", () => process.exit(1));
process.on("unhandledRejection", () => process.exit(1));
process.stdin.resume();
process.stdin.on("error", () => {});
process.stdin.on("close", () => process.exit(0));

const transport = new StdioServerTransport();
await server.connect(transport);
