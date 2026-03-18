import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const REPO = process.env.DAX_REPO_PATH || "P:/_clients/dakona/dax";
const AZURE_SUB = process.env.AZURE_SUBSCRIPTION || "";
const AZURE_RG = process.env.AZURE_RG || "rg-dax-dakona-pilot";
const AZURE_CA = process.env.AZURE_CONTAINER_APP || "ca-dax-dakona-pilot";
const N8N_URL = process.env.N8N_URL || "https://n8n.dakona.net";
const N8N_API_KEY = process.env.N8N_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4";

function run(cmd, { timeout = 120_000, cwd = REPO, shell } = {}) {
  try {
    const out = execSync(cmd, {
      cwd, timeout, encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      shell: shell || true,
    });
    return out;
  } catch (err) {
    const parts = [];
    if (err.stdout) parts.push(err.stdout);
    if (err.stderr) parts.push(err.stderr);
    if (parts.length === 0) parts.push(err.message);
    return `ERROR: ${parts.join("\n")}`;
  }
}

// Run PowerShell using base64-encoded command to avoid ALL quoting issues
function runPowerShell(script, { timeout = 120_000, cwd = REPO } = {}) {
  try {
    // Encode script as UTF-16LE base64 — what PowerShell -EncodedCommand expects
    const utf16 = Buffer.from(script, "utf16le");
    const encoded = utf16.toString("base64");
    const out = execSync(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encoded}`, {
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

server.tool("run_powershell", "Execute a PowerShell command or script and return its output. Supports multi-line scripts, here-strings, and complex quoting without any escaping needed.",
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
    const script = `az containerapp logs show -n ${AZURE_CA} -g ${AZURE_RG} ${sub} --tail ${tail} --type console 2>&1`;
    let out = runPowerShell(script);
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
    const psScript = `& "${script}" -ClientName "dakona-pilot" -ClientTenantId "d2a3c346-00f3-47dd-a53e-caa3fca74714" -LibreChatUrl "https://dax.dakona.com"`;
    return { content: [{ type: "text", text: runPowerShell(psScript, { timeout: 180_000 }) }] };
  }
);

server.tool("n8n_list_workflows", "List all workflows from the n8n instance",
  { n8nUrl: z.string().optional() },
  async ({ n8nUrl }) => {
    const base = n8nUrl || N8N_URL;
    const url = `${base.replace(/\/+$/, "")}/api/v1/workflows?limit=50`;
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "X-N8N-API-KEY": N8N_API_KEY },
      });
      if (!res.ok) return { content: [{ type: "text", text: `ERROR: ${res.status} ${res.statusText} from ${url}` }], isError: true };
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
      const res = await fetch(url, {
        headers: { Accept: "application/json", "X-N8N-API-KEY": N8N_API_KEY },
      });
      if (!res.ok) return { content: [{ type: "text", text: `ERROR: ${res.status} ${res.statusText}` }], isError: true };
      const body = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(body, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
    }
  }
);

server.tool("n8n_create_workflow", "Create a new n8n workflow",
  { workflow: z.record(z.any()) },
  async ({ workflow }) => {
    const url = `${N8N_URL}/api/v1/workflows`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-N8N-API-KEY": N8N_API_KEY },
        body: JSON.stringify(workflow),
      });
      const body = await res.json();
      if (!res.ok) return { content: [{ type: "text", text: `ERROR: ${res.status} - ${JSON.stringify(body)}` }], isError: true };
      return { content: [{ type: "text", text: `Created workflow: ${body.id} — ${body.name}` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
    }
  }
);

server.tool("n8n_update_workflow", "Update an existing n8n workflow by ID",
  { workflowId: z.string(), workflow: z.record(z.any()) },
  async ({ workflowId, workflow }) => {
    const url = `${N8N_URL}/api/v1/workflows/${workflowId}`;
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-N8N-API-KEY": N8N_API_KEY },
        body: JSON.stringify(workflow),
      });
      const body = await res.json();
      if (!res.ok) return { content: [{ type: "text", text: `ERROR: ${res.status} - ${JSON.stringify(body)}` }], isError: true };
      return { content: [{ type: "text", text: `Updated workflow: ${workflowId}` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
    }
  }
);

server.tool("n8n_activate_workflow", "Activate or deactivate an n8n workflow",
  { workflowId: z.string(), active: z.boolean() },
  async ({ workflowId, active }) => {
    const url = `${N8N_URL}/api/v1/workflows/${workflowId}/${active ? "activate" : "deactivate"}`;
    try {
      const res = await fetch(url, {
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
      const kvName = "kvdaxdakonapilot";
      const sub = AZURE_SUB ? `--subscription "${AZURE_SUB}"` : "";
      mongoUri = runPowerShell(`az keyvault secret show --vault-name ${kvName} --name cosmos-connection-string ${sub} --query value -o tsv`).trim();
      if (mongoUri.startsWith("ERROR")) return { content: [{ type: "text", text: "ERROR: Could not retrieve MONGO_URI. " + mongoUri }], isError: true };
    }
    const evalStr = `db.getCollection('${collection}').find(${JSON.stringify(query)}).limit(${limit}).toArray()`;
    const psScript = `mongosh "${mongoUri}" --quiet --eval "${evalStr.replace(/"/g, '\\"')}"`;
    return { content: [{ type: "text", text: runPowerShell(psScript, { timeout: 30_000 }) }] };
  }
);

process.on("uncaughtException", () => process.exit(1));
process.on("unhandledRejection", () => process.exit(1));
process.stdin.resume();
process.stdin.on("error", () => {});
process.stdin.on("close", () => process.exit(0));

const transport = new StdioServerTransport();
await server.connect(transport);
