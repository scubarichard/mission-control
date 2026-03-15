import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

// ---------------------------------------------------------------------------
// Environment defaults
// ---------------------------------------------------------------------------
const REPO = process.env.DAX_REPO_PATH || "P:/_clients/dakona/dax";
const AZURE_SUB = process.env.AZURE_SUBSCRIPTION || "";
const AZURE_RG = process.env.AZURE_RG || "rg-dax-dakona-pilot";
const AZURE_CA = process.env.AZURE_CONTAINER_APP || "ca-dax-dakona-pilot";
const N8N_URL = process.env.N8N_URL || "https://n8n.dakona.net";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run a shell command synchronously and return stdout+stderr as a string. */
function run(cmd, { timeout = 120_000, cwd = REPO, shell } = {}) {
  try {
    const out = execSync(cmd, {
      cwd,
      timeout,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      shell: shell || true,
    });
    return out;
  } catch (err) {
    // err.stdout / err.stderr may contain useful output even on failure
    const parts = [];
    if (err.stdout) parts.push(err.stdout);
    if (err.stderr) parts.push(err.stderr);
    if (parts.length === 0) parts.push(err.message);
    return `ERROR: ${parts.join("\n")}`;
  }
}

/** Resolve a relative path against the repo root. Blocks path traversal. */
function resolvePath(relPath) {
  const resolved = path.resolve(REPO, relPath);
  if (!resolved.startsWith(path.resolve(REPO))) {
    throw new Error("Path traversal outside the repo is not allowed");
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
const server = new McpServer({
  name: "dax-dev",
  version: "1.0.0",
});

// 1. read_file ---------------------------------------------------------------
server.tool(
  "read_file",
  "Read any file in the DAX repo by relative path",
  { path: z.string().describe("File path relative to the DAX repo root") },
  async ({ path }) => {
    try {
      const abs = resolvePath(path);
      const content = readFileSync(abs, "utf-8");
      return { content: [{ type: "text", text: content }] };
    } catch (err) {
      return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
    }
  }
);

// 2. write_file --------------------------------------------------------------
server.tool(
  "write_file",
  "Write or update a file in the DAX repo, creating directories as needed",
  {
    path: z.string().describe("File path relative to the DAX repo root"),
    content: z.string().describe("File content to write"),
  },
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

// 3. run_powershell ----------------------------------------------------------
server.tool(
  "run_powershell",
  "Execute a PowerShell command and return its output",
  { command: z.string().describe("PowerShell command or script block to execute") },
  async ({ command }) => {
    const out = run(`powershell.exe -NoProfile -Command "${command.replace(/"/g, '\\"')}"`, {
      timeout: 120_000,
    });
    return { content: [{ type: "text", text: out }] };
  }
);

// 4. git_status --------------------------------------------------------------
server.tool(
  "git_status",
  "Show the current git status of the DAX repo",
  {},
  async () => {
    const out = run("git status");
    return { content: [{ type: "text", text: out }] };
  }
);

// 5. git_commit_push ---------------------------------------------------------
server.tool(
  "git_commit_push",
  "Stage all changes, commit with the given message, and push to the remote",
  { message: z.string().describe("Commit message") },
  async ({ message }) => {
    try {
      run("git add -A");
      const commitOut = run(`git commit -m "${message.replace(/"/g, '\\"')}"`);
      const pushOut = run("git push");
      const hash = run("git rev-parse --short HEAD").trim();
      return {
        content: [
          {
            type: "text",
            text: `Committed and pushed: ${hash}\n\n${commitOut}\n${pushOut}`,
          },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
    }
  }
);

// 6. azure_container_logs ----------------------------------------------------
server.tool(
  "azure_container_logs",
  "Fetch recent logs from the DAX Azure Container App",
  {
    tail: z.number().optional().default(50).describe("Number of log lines to retrieve (default 50)"),
    filter: z.string().optional().describe("Optional text filter applied to log output"),
  },
  async ({ tail, filter }) => {
    const sub = AZURE_SUB ? `--subscription "${AZURE_SUB}"` : "";
    const cmd = `az containerapp logs show -n ${AZURE_CA} -g ${AZURE_RG} ${sub} --tail ${tail} --type console`;
    let out = run(cmd);
    if (filter) {
      out = out
        .split("\n")
        .filter((line) => line.toLowerCase().includes(filter.toLowerCase()))
        .join("\n");
      if (!out) out = `No log lines matched filter: ${filter}`;
    }
    return { content: [{ type: "text", text: out }] };
  }
);

// 7. azure_revision ----------------------------------------------------------
server.tool(
  "azure_revision",
  "List active revisions of the DAX Azure Container App",
  {},
  async () => {
    const sub = AZURE_SUB ? `--subscription "${AZURE_SUB}"` : "";
    const cmd = `az containerapp revision list -n ${AZURE_CA} -g ${AZURE_RG} ${sub} -o table`;
    const out = run(cmd);
    return { content: [{ type: "text", text: out }] };
  }
);

// 8. deploy_sso_config -------------------------------------------------------
server.tool(
  "deploy_sso_config",
  "Run Deploy-SSOConfig.ps1 for the dakona-pilot client",
  {},
  async () => {
    const script = join(REPO, "scripts", "Deploy-SSOConfig.ps1");
    const cmd = [
      `powershell.exe -NoProfile -File "${script}"`,
      `-ClientName "dakona-pilot"`,
      `-ClientTenantId "d2a3c346-00f3-47dd-a53e-caa3fca74714"`,
      `-LibreChatUrl "https://dax.dakona.com"`,
    ].join(" ");
    const out = run(cmd, { timeout: 120_000 });
    return { content: [{ type: "text", text: out }] };
  }
);

// 9. n8n_list_workflows ------------------------------------------------------
server.tool(
  "n8n_list_workflows",
  "List all workflows from the n8n instance",
  {
    n8nUrl: z.string().optional().describe("Base URL of the n8n instance (defaults to N8N_URL env var)"),
  },
  async ({ n8nUrl }) => {
    const base = n8nUrl || N8N_URL;
    const url = `${base.replace(/\/+$/, "")}/api/v1/workflows`;
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        return {
          content: [{ type: "text", text: `ERROR: ${res.status} ${res.statusText} from ${url}` }],
          isError: true,
        };
      }
      const body = await res.json();
      const workflows = (body.data || body).map((w) => ({
        id: w.id,
        name: w.name,
        active: w.active,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(workflows, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
    }
  }
);

// 10. cosmos_query -----------------------------------------------------------
server.tool(
  "cosmos_query",
  "Query a Cosmos DB (MongoDB API) collection. Requires MONGO_URI env var or Azure CLI access to Key Vault.",
  {
    collection: z.string().describe("Name of the MongoDB collection to query"),
    query: z.record(z.any()).describe("MongoDB query filter object"),
    limit: z.number().optional().default(10).describe("Maximum number of documents to return (default 10)"),
  },
  async ({ collection, query, limit }) => {
    let mongoUri = process.env.MONGO_URI;

    // If no MONGO_URI, try fetching from Key Vault
    if (!mongoUri) {
      try {
        const kvName = "kvdaxdakonapilot";
        const sub = AZURE_SUB ? `--subscription "${AZURE_SUB}"` : "";
        mongoUri = run(
          `az keyvault secret show --vault-name ${kvName} --name cosmos-connection-string ${sub} --query value -o tsv`
        ).trim();
        if (mongoUri.startsWith("ERROR")) {
          return {
            content: [
              {
                type: "text",
                text: "ERROR: MONGO_URI not set and could not retrieve from Key Vault. " + mongoUri,
              },
            ],
            isError: true,
          };
        }
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `ERROR: MONGO_URI not set and Key Vault lookup failed: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    // Use mongosh or a simple Node driver approach via shell
    // Since we want to avoid requiring mongodb driver as a dependency,
    // we shell out to mongosh if available, otherwise use az cosmos query.
    try {
      const queryJson = JSON.stringify(query).replace(/"/g, '\\"');
      const cmd = [
        `mongosh "${mongoUri}" --quiet --eval`,
        `"db.getCollection('${collection}').find(${JSON.stringify(query)}).limit(${limit}).toArray()"`,
      ].join(" ");
      const out = run(cmd, { timeout: 30_000 });
      return { content: [{ type: "text", text: out }] };
    } catch (err) {
      return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
    }
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

// Catch uncaught errors — exit so Claude Desktop sees a clean disconnect
process.on("uncaughtException", () => process.exit(1));
process.on("unhandledRejection", () => process.exit(1));

// Keep the process alive when stdin has no TTY (e.g. SSH from Claude Desktop).
// Without this, Node sees no pending I/O and exits immediately.
process.stdin.resume();
process.stdin.on("error", () => {});
process.stdin.on("close", () => process.exit(0));

const transport = new StdioServerTransport();
await server.connect(transport);
