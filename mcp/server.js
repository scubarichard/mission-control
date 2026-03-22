import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

/* ── Config ─────────────────────────────────────────────────────────── */

const REPO = process.env.DAX_REPO_PATH || "P:/_clients/dakona/dax";
const AZURE_SUB = process.env.AZURE_SUBSCRIPTION || "";
const AZURE_RG = process.env.AZURE_RG || "rg-dax-dakona-pilot";
const AZURE_CA = process.env.AZURE_CONTAINER_APP || "ca-dax-dakona-pilot";
const N8N_URL = process.env.N8N_URL || "https://n8n.dakona.net";
const N8N_API_KEY = process.env.N8N_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4";
const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY || "pk_106144226_VOUJ8CKLMYGIIB8JQHMQEMS83LWFH8M7";
const CLICKUP_BASE = "https://api.clickup.com/api/v2";
const MAKE_API_KEY = process.env.MAKE_API_KEY || "8ce569c4-a7a9-492b-a461-3aa8317ce6db";
const MAKE_BASE = "https://us2.make.com/api/v2";
const SLACK_TOKEN = process.env.RPE_SLACK_TOKEN || "";

const PWSH = process.platform === "win32" ? "powershell.exe" : "pwsh";

/* ── Helpers ────────────────────────────────────────────────────────── */

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

function runPowerShell(script, { timeout = 120_000, cwd = REPO } = {}) {
  const tmpFile = join(tmpdir(), `dax-ps-${randomBytes(6).toString("hex")}.ps1`);
  try {
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    const content = Buffer.concat([bom, Buffer.from(script, "utf-8")]);
    writeFileSync(tmpFile, content);
    const out = execSync(`${PWSH} -NoProfile -NonInteractive -File "${tmpFile}"`, {
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
    try { unlinkSync(tmpFile); } catch {}
  }
}

function resolvePath(relPath) {
  const resolved = resolve(join(REPO, relPath));
  if (!resolved.startsWith(resolve(REPO))) throw new Error("Path traversal outside the repo is not allowed");
  return resolved;
}

/* ── Tool registration ──────────────────────────────────────────────── */

function registerTools(server) {
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

  server.tool("search_code", "Search the DAX repo for a pattern (regex supported). Returns matching lines with file paths and line numbers.",
    { pattern: z.string(), glob: z.string().optional().describe("File glob filter, e.g. '*.js' or '*.ps1'"), maxResults: z.number().optional().default(50) },
    async ({ pattern, glob, maxResults }) => {
      try {
        const globArg = glob ? `-- "${glob}"` : "";
        const out = run(`git grep -n -E "${pattern.replace(/"/g, '\\"')}" ${globArg}`, { timeout: 30_000 });
        if (!out || out.startsWith("ERROR")) return { content: [{ type: "text", text: out || "No matches found" }] };
        const lines = out.split("\n").slice(0, maxResults);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("list_files", "List files and directories in the DAX repo. Supports glob patterns.",
    { path: z.string().optional().default("."), pattern: z.string().optional().describe("Glob pattern like '**/*.js' or 'scripts/*.ps1'") },
    async ({ path, pattern }) => {
      try {
        if (pattern) {
          const out = run(`git ls-files "${pattern}"`);
          return { content: [{ type: "text", text: out || "No files matched" }] };
        }
        const abs = resolvePath(path);
        const { readdirSync, statSync } = await import("node:fs");
        const entries = readdirSync(abs).map(name => {
          try {
            const s = statSync(join(abs, name));
            return `${s.isDirectory() ? "d" : "-"}  ${String(s.size).padStart(8)}  ${name}`;
          } catch { return `?           ${name}`; }
        });
        return { content: [{ type: "text", text: entries.join("\n") }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("git_diff", "Show git diff of uncommitted changes, or diff between branches/commits",
    { ref: z.string().optional().describe("Branch, commit, or range like 'main..HEAD'. Omit for working tree diff.") },
    async ({ ref }) => {
      try {
        const cmd = ref ? `git diff ${ref}` : "git diff";
        return { content: [{ type: "text", text: run(cmd) || "(no changes)" }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("git_log", "Show recent git commit history",
    { count: z.number().optional().default(10), path: z.string().optional().describe("Filter to commits touching this file/directory") },
    async ({ count, path }) => {
      try {
        const pathArg = path ? `-- "${path}"` : "";
        return { content: [{ type: "text", text: run(`git log --oneline -${count} ${pathArg}`) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("git_pull", "Pull latest changes from the remote",
    {},
    async () => {
      try {
        return { content: [{ type: "text", text: run("git pull --ff-only") }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("deploy_container_app", "Build and deploy a container app image via ACR. Defaults to rebuilding the MCP server itself.",
    {
      imageName: z.string().optional().default("mcp-server"),
      dockerContext: z.string().optional().default("mcp"),
      containerApp: z.string().optional().default("ca-dax-mcp-dakona-pilot"),
    },
    async ({ imageName, dockerContext, containerApp }) => {
      try {
        const sub = AZURE_SUB ? `--subscription "${AZURE_SUB}"` : "";
        const acr = "acrdaxdakona";
        const contextPath = resolve(join(REPO, dockerContext));

        const buildOut = run(
          `az acr build --registry ${acr} -g ${AZURE_RG} ${sub} --image ${imageName}:latest --file ${contextPath}/Dockerfile ${contextPath}`,
          { timeout: 300_000 }
        );
        if (buildOut.includes("ERROR")) return { content: [{ type: "text", text: buildOut }], isError: true };

        const updateOut = run(
          `az containerapp update -n ${containerApp} -g ${AZURE_RG} ${sub} --image ${acr}.azurecr.io/${imageName}:latest`,
          { timeout: 120_000 }
        );

        return { content: [{ type: "text", text: `Deployed ${imageName}:latest to ${containerApp}\n\n${updateOut}` }] };
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

  // ── ClickUp tools ──────────────────────────────────────────────────

  async function clickupApi(path, { method = "GET", body } = {}) {
    const opts = {
      method,
      headers: { Authorization: CLICKUP_API_KEY, "Content-Type": "application/json" },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${CLICKUP_BASE}${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(`${res.status} — ${JSON.stringify(data)}`);
    return data;
  }

  server.tool("clickup_list_spaces", "List all ClickUp workspaces and their spaces",
    {},
    async () => {
      try {
        const teams = await clickupApi("/team");
        const results = [];
        for (const team of teams.teams) {
          const spaces = await clickupApi(`/team/${team.id}/space?archived=false`);
          results.push({
            workspace: { id: team.id, name: team.name },
            spaces: spaces.spaces.map(s => ({ id: s.id, name: s.name })),
          });
        }
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("clickup_list_folders", "List all folders in a ClickUp space",
    { spaceId: z.string().describe("ClickUp space ID") },
    async ({ spaceId }) => {
      try {
        const data = await clickupApi(`/space/${spaceId}/folder?archived=false`);
        const folders = data.folders.map(f => ({
          id: f.id,
          name: f.name,
          lists: f.lists?.map(l => ({ id: l.id, name: l.name })) || [],
        }));
        return { content: [{ type: "text", text: JSON.stringify(folders, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("clickup_create_list", "Create a new list in a ClickUp folder or space",
    {
      name: z.string().describe("Name of the list"),
      folderId: z.string().optional().describe("Folder ID to create list in (use this OR spaceId)"),
      spaceId: z.string().optional().describe("Space ID to create folderless list in (use this OR folderId)"),
      content: z.string().optional().describe("Description/content for the list"),
      status: z.string().optional().describe("Status to use (default uses space/folder default statuses)"),
    },
    async ({ name, folderId, spaceId, content, status }) => {
      try {
        if (!folderId && !spaceId) {
          throw new Error("Either folderId or spaceId is required");
        }
        const endpoint = folderId ? `/folder/${folderId}/list` : `/space/${spaceId}/list`;
        const body = { name };
        if (content) body.content = content;
        if (status) body.status = status;
        const list = await clickupApi(endpoint, { method: "POST", body });
        return { content: [{ type: "text", text: `Created list: ${list.id} — ${list.name}\nURL: https://app.clickup.com/${list.id}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("clickup_list_tasks", "List tasks in a ClickUp list (or search by space/folder)",
    {
      listId: z.string().describe("ClickUp list ID"),
      includeSubtasks: z.boolean().optional().default(false),
      statuses: z.array(z.string()).optional().describe("Filter by status names"),
      page: z.number().optional().default(0),
    },
    async ({ listId, includeSubtasks, statuses, page }) => {
      try {
        let url = `/list/${listId}/task?page=${page}&subtasks=${includeSubtasks}`;
        if (statuses?.length) url += statuses.map(s => `&statuses[]=${encodeURIComponent(s)}`).join("");
        const data = await clickupApi(url);
        const tasks = data.tasks.map(t => ({
          id: t.id, name: t.name, status: t.status?.status,
          assignees: t.assignees?.map(a => a.username), due_date: t.due_date,
          priority: t.priority?.priority, url: t.url,
        }));
        return { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("clickup_get_task", "Get full details of a ClickUp task by ID",
    { taskId: z.string() },
    async ({ taskId }) => {
      try {
        const t = await clickupApi(`/task/${taskId}`);
        return { content: [{ type: "text", text: JSON.stringify(t, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("clickup_create_task", "Create a new task in a ClickUp list",
    {
      listId: z.string().describe("ClickUp list ID"),
      name: z.string(),
      description: z.string().optional(),
      status: z.string().optional(),
      priority: z.number().optional().describe("1=urgent, 2=high, 3=normal, 4=low"),
      assignees: z.array(z.number()).optional().describe("Array of ClickUp user IDs"),
      due_date: z.string().optional().describe("Due date as ISO string or Unix ms timestamp"),
      tags: z.array(z.string()).optional(),
    },
    async ({ listId, name, description, status, priority, assignees, due_date, tags }) => {
      try {
        const body = { name };
        if (description) body.description = description;
        if (status) body.status = status;
        if (priority) body.priority = priority;
        if (assignees) body.assignees = assignees;
        if (due_date) body.due_date = isNaN(due_date) ? new Date(due_date).getTime() : Number(due_date);
        if (tags) body.tags = tags;
        const task = await clickupApi(`/list/${listId}/task`, { method: "POST", body });
        return { content: [{ type: "text", text: `Created: ${task.id} — ${task.name}\nURL: ${task.url}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("clickup_update_task", "Update an existing ClickUp task",
    {
      taskId: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      priority: z.number().optional().describe("1=urgent, 2=high, 3=normal, 4=low"),
      assignees: z.object({
        add: z.array(z.number()).optional(),
        rem: z.array(z.number()).optional(),
      }).optional(),
      due_date: z.string().optional().describe("Due date as ISO string or Unix ms timestamp"),
    },
    async ({ taskId, name, description, status, priority, assignees, due_date }) => {
      try {
        const body = {};
        if (name) body.name = name;
        if (description !== undefined) body.description = description;
        if (status) body.status = status;
        if (priority) body.priority = priority;
        if (assignees) body.assignees = assignees;
        if (due_date) body.due_date = isNaN(due_date) ? new Date(due_date).getTime() : Number(due_date);
        const task = await clickupApi(`/task/${taskId}`, { method: "PUT", body });
        return { content: [{ type: "text", text: `Updated: ${task.id} — ${task.name} [${task.status?.status}]` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("clickup_add_comment", "Add a comment to a ClickUp task",
    { taskId: z.string(), text: z.string() },
    async ({ taskId, text }) => {
      try {
        const comment = await clickupApi(`/task/${taskId}/comment`, {
          method: "POST",
          body: { comment_text: text },
        });
        return { content: [{ type: "text", text: `Comment added to ${taskId}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  // ── Make.com tools ─────────────────────────────────────────────────

  async function makeApi(path, { method = "GET", body } = {}) {
    const opts = {
      method,
      headers: { Authorization: `Token ${MAKE_API_KEY}`, "Content-Type": "application/json" },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${MAKE_BASE}${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(`${res.status} — ${data.message || JSON.stringify(data)}`);
    return data;
  }

  server.tool("make_list_orgs", "List Make.com organizations",
    {},
    async () => {
      try {
        const data = await makeApi("/organizations");
        const orgs = data.organizations.map(o => ({ id: o.id, name: o.name, zone: o.zone }));
        return { content: [{ type: "text", text: JSON.stringify(orgs, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("make_list_scenarios", "List Make.com scenarios for an organization",
    { organizationId: z.number().describe("Organization ID (1AltX=5193163, RPE=6370899)") },
    async ({ organizationId }) => {
      try {
        const data = await makeApi(`/scenarios?organizationId=${organizationId}`);
        const scenarios = data.scenarios.map(s => ({
          id: s.id, name: s.name, active: s.islinked,
          teamId: s.teamId, folderId: s.folderId,
          nextExec: s.nextExec, scheduling: s.scheduling?.type,
        }));
        return { content: [{ type: "text", text: JSON.stringify(scenarios, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("make_get_scenario", "Get full details of a Make.com scenario by ID",
    { scenarioId: z.number() },
    async ({ scenarioId }) => {
      try {
        const data = await makeApi(`/scenarios/${scenarioId}`);
        return { content: [{ type: "text", text: JSON.stringify(data.scenario, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("make_run_scenario", "Trigger a Make.com scenario to run immediately",
    { scenarioId: z.number() },
    async ({ scenarioId }) => {
      try {
        const data = await makeApi(`/scenarios/${scenarioId}/run`, { method: "POST", body: {} });
        return { content: [{ type: "text", text: `Scenario ${scenarioId} triggered. Execution ID: ${data.executionId || "started"}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("make_scenario_toggle", "Activate or deactivate a Make.com scenario",
    { scenarioId: z.number(), activate: z.boolean() },
    async ({ scenarioId, activate }) => {
      try {
        const endpoint = activate ? "start" : "stop";
        const data = await makeApi(`/scenarios/${scenarioId}/${endpoint}`, { method: "POST", body: {} });
        return { content: [{ type: "text", text: `Scenario ${scenarioId} ${activate ? "activated" : "deactivated"}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("make_scenario_logs", "Get recent execution logs for a Make.com scenario",
    { scenarioId: z.number(), limit: z.number().optional().default(10) },
    async ({ scenarioId, limit }) => {
      try {
        const data = await makeApi(`/scenarios/${scenarioId}/logs?pg%5Blimit%5D=${limit}&pg%5BsortDir%5D=desc`);
        const logs = (data.scenarioLogs || []).map(l => ({
          id: l.id, status: l.status, duration: l.duration,
          operations: l.operations, timestamp: l.timestamp,
        }));
        return { content: [{ type: "text", text: JSON.stringify(logs, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  // ── Slack tools ────────────────────────────────────────────────────

  async function slackApi(method, body) {
    const res = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SLACK_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    return data;
  }

  server.tool("slack_list_channels", "List Slack channels in the RPE workspace",
    { limit: z.number().optional().default(100), types: z.string().optional().default("public_channel,private_channel").describe("Channel types: public_channel, private_channel, mpim, im") },
    async ({ limit, types }) => {
      try {
        const data = await slackApi("conversations.list", { limit, types, exclude_archived: true });
        const channels = data.channels.map(c => ({ id: c.id, name: c.name, topic: c.topic?.value, is_private: c.is_private }));
        return { content: [{ type: "text", text: JSON.stringify(channels, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool("slack_post_message", "Post a message to a Slack channel in the RPE workspace",
    { channel: z.string().describe("Channel ID or name (e.g. #general or C0123456)"), text: z.string() },
    async ({ channel, text }) => {
      try {
        const data = await slackApi("chat.postMessage", { channel, text });
        return { content: [{ type: "text", text: `Message posted to ${data.channel} (ts: ${data.ts})` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `ERROR: ${err.message}` }], isError: true };
      }
    }
  );
}

/* ── Transport selection ────────────────────────────────────────────── */

const MODE = process.env.MCP_TRANSPORT || (process.argv.includes("--sse") ? "sse" : "stdio");

if (MODE === "sse") {
  /* ── HTTP/SSE mode for claude.ai remote MCP ─────────────────────── */
  const express = (await import("express")).default;
  const PORT = parseInt(process.env.PORT || "3001", 10);
  const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || "";
  const KEEPALIVE_INTERVAL_MS = 25_000; // Azure idle timeout is 230s; ping well under that

  const app = express();
  const sessions = new Map();

  // CORS — claude.ai requires cross-origin access to the SSE and messages endpoints
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    // Allow claude.ai and any subdomain, plus anything in CORS_ORIGINS env var
    const allowed = [
      "https://claude.ai",
      /^https:\/\/.*\.claude\.ai$/,
      ...(process.env.CORS_ORIGINS || "").split(",").filter(Boolean),
    ];
    const isAllowed = !origin || allowed.some(o =>
      typeof o === "string" ? o === origin : o.test(origin)
    );
    if (isAllowed) {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, mcp-session-id");
    res.setHeader("Access-Control-Expose-Headers", "Content-Type, mcp-session-id");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // Optional bearer-token auth (skip for /health)
  if (AUTH_TOKEN) {
    app.use((req, res, next) => {
      if (req.path === "/health") return next();
      const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (token !== AUTH_TOKEN) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      next();
    });
  }

  app.use(express.json());

  // Health check — useful for Azure probes and manual testing
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      server: "dax-dev",
      transport: "sse",
      activeSessions: sessions.size,
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  // SSE endpoint — client connects here to establish the event stream
  app.get("/sse", async (req, res) => {
    console.log(`[SSE] New connection from ${req.ip}`);

    const transport = new SSEServerTransport("/messages", res);
    sessions.set(transport.sessionId, transport);

    // Keepalive: send SSE comment every 25s to prevent Azure/proxy idle timeout
    const ping = setInterval(() => {
      try {
        res.write(": keepalive\n\n");
      } catch {
        clearInterval(ping);
      }
    }, KEEPALIVE_INTERVAL_MS);

    // Create a fresh MCP server for this session
    const mcpServer = new McpServer({ name: "dax-dev", version: "1.0.0" });
    registerTools(mcpServer);

    // Cleanup on disconnect
    res.on("close", () => {
      console.log(`[SSE] Connection closed: ${transport.sessionId}`);
      clearInterval(ping);
      sessions.delete(transport.sessionId);
    });

    await mcpServer.connect(transport);
  });

  // Messages endpoint — client POSTs JSON-RPC tool calls here
  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId;
    const transport = sessions.get(sessionId);
    if (!transport) {
      return res.status(404).json({ error: "Session not found", sessionId });
    }
    await transport.handlePostMessage(req, res, req.body);
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("[SSE] Shutting down...");
    for (const [sid, transport] of sessions) {
      try { await transport.close(); } catch {}
      sessions.delete(sid);
    }
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    console.log("[SSE] SIGTERM received, shutting down...");
    for (const [sid, transport] of sessions) {
      try { await transport.close(); } catch {}
      sessions.delete(sid);
    }
    process.exit(0);
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DAX MCP server (SSE) listening on http://0.0.0.0:${PORT}`);
    console.log(`  GET  /sse      — SSE stream for claude.ai`);
    console.log(`  POST /messages — JSON-RPC tool calls`);
    console.log(`  GET  /health   — health check`);
    console.log(`  Keepalive: every ${KEEPALIVE_INTERVAL_MS / 1000}s`);
    if (AUTH_TOKEN) console.log(`  Auth: Bearer token required`);
    else console.log(`  Auth: NONE (set MCP_AUTH_TOKEN to enable)`);
  });

} else {
  /* ── Stdio mode for Claude Desktop ──────────────────────────────── */
  process.on("uncaughtException", () => process.exit(1));
  process.on("unhandledRejection", () => process.exit(1));
  process.stdin.resume();
  process.stdin.on("error", () => {});
  process.stdin.on("close", () => process.exit(0));

  const server = new McpServer({ name: "dax-dev", version: "1.0.0" });
  registerTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
