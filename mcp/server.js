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

server.tool("run_powershell", "Execute a PowerShell command and return its output",
  { command: z.string() },
  async ({ command }) => {
    const out = run(`powershell.exe -NoProfile -Command "${command.replace(/"/g, '\\"')}"`, { timeout: 120_000 });
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
      const commitOut = run(`git commit -m "${message.replace(/"/g, '\\"')}"`);
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
    let out = run(`az containerapp logs show -n ${AZURE_CA} -g ${AZURE_RG} ${sub} --tail ${tail} --type console`);
    if (filter) out = out.split("\n").filter(l => l.toLowerCase().includes(filter.toLowerCase())).join("\n") || `No lines matched: ${filter}`;
    return { content: [{ type: "text", text: out }] };
  }
);

server.tool("azure_revision", "List active revisions of the DAX Azure Container App", {},
  async () => {
    const sub = AZURE_SUB ? `--subscription "${AZURE_SUB}"` : "";
    return { content: [{ type: "text", text: run(`az containerapp revision list -n ${AZURE_CA} -g ${AZURE_RG} ${sub} -o table`) }] };
  }
);

server.tool("deploy_sso_config", "Run Deploy-SSOConfig.ps1 for the dakona-pilot client", {},
  async () => {
    const script = join(REPO, "scripts", "Deploy-SSOConfig.ps1");
    const cmd = `powershell.exe -NoProfile -File "${script}" -ClientName "dakona-pilot" -ClientTenantId "d2a3c346-00f3-47dd-a53e-caa3fca74714" -LibreChatUrl "https://dax.dakona.com"`;
    return { content: [{ type: "text", text: run(cmd, { timeout: 120_000 }) }] };
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

server.tool("cosmos_query", "Query a Cosmos DB (MongoDB API) collection.",
  { collection: z.string(), query: z.record(z.any()), limit: z.number().optional().default(10) },
  async ({ collection, query, limit }) => {
    let mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      const kvName = "kvdaxdakonapilot";
      const sub = AZURE_SUB ? `--subscription "${AZURE_SUB}"` : "";
      mongoUri = run(`az keyvault secret show --vault-name ${kvName} --name cosmos-connection-string ${sub} --query value -o tsv`).trim();
      if (mongoUri.startsWith("ERROR")) return { content: [{ type: "text", text: "ERROR: Could not retrieve MONGO_URI. " + mongoUri }], isError: true };
    }
    const cmd = `mongosh "${mongoUri}" --quiet --eval "db.getCollection('${collection}').find(${JSON.stringify(query)}).limit(${limit}).toArray()"`;
    return { content: [{ type: "text", text: run(cmd, { timeout: 30_000 }) }] };
  }
);

process.on("uncaughtException", () => process.exit(1));
process.on("unhandledRejection", () => process.exit(1));
process.stdin.resume();
process.stdin.on("error", () => {});
process.stdin.on("close", () => process.exit(0));

const transport = new StdioServerTransport();
await server.connect(transport);
