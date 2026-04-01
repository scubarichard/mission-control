#!/usr/bin/env node
/**
 * ClickUp ↔ GitHub Task Queue Sync Daemon
 * Syncs TASK_QUEUE.md with ClickUp list bi-directionally.
 *
 * ENV:
 *   CLICKUP_API_KEY   — ClickUp personal API token
 *   CLICKUP_LIST_ID   — Target list (default: 901712338015)
 *   TASK_QUEUE_PATH   — Path to TASK_QUEUE.md (default: ./TASK_QUEUE.md)
 *   REPO_DIR          — Git repo dir (default: .)
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const API_KEY = process.env.CLICKUP_API_KEY;
const LIST_ID = process.env.CLICKUP_LIST_ID || '901712338015';
const TASK_QUEUE_PATH = process.env.TASK_QUEUE_PATH || './TASK_QUEUE.md';
const REPO_DIR = process.env.REPO_DIR || '.';

if (!API_KEY) {
  console.error('CLICKUP_API_KEY not set');
  process.exit(1);
}

const CLICKUP_BASE = 'https://api.clickup.com/api/v2';

async function clickupFetch(path, options = {}) {
  const url = `${CLICKUP_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ClickUp API ${res.status}: ${text}`);
  }
  return res.json();
}

// --- Parse TASK_QUEUE.md ---

function parseTaskQueue(content) {
  const tasks = [];
  const taskBlocks = content.split(/^### /m).slice(1);

  for (const block of taskBlocks) {
    const lines = block.trim().split('\n');
    const titleLine = lines[0];
    const taskIdMatch = titleLine.match(/^(TASK-\d{8}-\d{3})/);
    if (!taskIdMatch) continue;

    const taskId = taskIdMatch[1];
    const fields = {};
    for (const line of lines.slice(1)) {
      const m = line.match(/^- \*\*(\w[\w\s]*?):\*\*\s*(.+)/);
      if (m) fields[m[1].trim()] = m[2].trim();
    }

    tasks.push({
      taskId,
      assignee: fields['Assignee'] || '',
      status: fields['Status'] || '',
      priority: fields['Priority'] || 'Medium',
      task: fields['Task'] || '',
      context: fields['Context'] || '',
      deliverable: fields['Deliverable'] || '',
    });
  }
  return tasks;
}

// --- ClickUp helpers ---

async function getClickUpTasks() {
  const data = await clickupFetch(`/list/${LIST_ID}/task?include_closed=true`);
  return data.tasks || [];
}

async function createClickUpTask(ghTask) {
  const priorityMap = { Urgent: 1, High: 2, Medium: 3, Low: 4 };
  const statusMap = { PENDING: 'to do', IN_PROGRESS: 'in progress', DONE: 'complete', BLOCKED: 'to do' };

  return clickupFetch(`/list/${LIST_ID}/task`, {
    method: 'POST',
    body: JSON.stringify({
      name: `${ghTask.taskId}: ${ghTask.task}`,
      description: `**Assignee:** ${ghTask.assignee}\n**Context:** ${ghTask.context}\n**Deliverable:** ${ghTask.deliverable}`,
      status: statusMap[ghTask.status] || 'to do',
      priority: priorityMap[ghTask.priority] || 3,
      tags: [ghTask.assignee].filter(Boolean),
    }),
  });
}

async function updateClickUpStatus(clickupTaskId, ghStatus) {
  const statusMap = { PENDING: 'to do', IN_PROGRESS: 'in progress', DONE: 'complete', BLOCKED: 'to do' };
  const newStatus = statusMap[ghStatus];
  if (!newStatus) return;

  return clickupFetch(`/task/${clickupTaskId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: newStatus }),
  });
}

// --- GitHub → ClickUp sync ---

async function syncGitHubToClickUp(ghTasks, cuTasks) {
  let changes = 0;

  for (const ghTask of ghTasks) {
    // Find matching ClickUp task by task ID in name
    const cuTask = cuTasks.find(t => t.name.includes(ghTask.taskId));

    if (!cuTask) {
      // New task in GitHub, create in ClickUp
      console.log(`  → Creating ${ghTask.taskId} in ClickUp`);
      await createClickUpTask(ghTask);
      changes++;
    } else {
      // Check if status needs updating
      const statusMap = { 'to do': 'PENDING', 'in progress': 'IN_PROGRESS', 'complete': 'DONE' };
      const cuStatus = statusMap[cuTask.status.status?.toLowerCase()] || statusMap[cuTask.status?.toLowerCase()] || '';

      if (cuStatus !== ghTask.status) {
        console.log(`  → Updating ${ghTask.taskId}: ${cuStatus} → ${ghTask.status}`);
        await updateClickUpStatus(cuTask.id, ghTask.status);
        changes++;
      }
    }
  }
  return changes;
}

// --- ClickUp → GitHub sync ---

function syncClickUpToGitHub(ghTasks, cuTasks, content) {
  let updated = content;
  let changes = 0;
  const statusMap = { 'to do': 'PENDING', 'in progress': 'IN_PROGRESS', 'complete': 'DONE' };

  for (const cuTask of cuTasks) {
    // Only sync tasks with our naming convention
    const idMatch = cuTask.name.match(/(TASK-\d{8}-\d{3})/);
    if (!idMatch) continue;

    const taskId = idMatch[1];
    const ghTask = ghTasks.find(t => t.taskId === taskId);
    if (!ghTask) continue; // Task not in GitHub queue — skip

    const cuStatus = statusMap[cuTask.status.status?.toLowerCase()] || statusMap[cuTask.status?.toLowerCase()] || '';
    if (cuStatus && cuStatus !== ghTask.status) {
      // ClickUp status changed — update GitHub
      console.log(`  ← Updating ${taskId} in GitHub: ${ghTask.status} → ${cuStatus}`);
      updated = updated.replace(
        new RegExp(`(### ${taskId}[\\s\\S]*?Status:\\*\\*) ${ghTask.status}`),
        `$1 ${cuStatus}`
      );
      changes++;
    }
  }

  return { content: updated, changes };
}

// --- Git operations ---

function gitPull() {
  execSync('git pull --quiet', { cwd: REPO_DIR, stdio: 'pipe' });
}

function gitCommitAndPush(message) {
  execSync(`git add TASK_QUEUE.md && git commit -m "${message}" && git push`, {
    cwd: REPO_DIR,
    stdio: 'pipe',
  });
}

// --- Main ---

async function sync() {
  const timestamp = new Date().toISOString().slice(0, 19);
  console.log(`[${timestamp}] Sync starting...`);

  try {
    // Pull latest
    gitPull();

    // Parse GitHub tasks
    const content = readFileSync(TASK_QUEUE_PATH, 'utf-8');
    const ghTasks = parseTaskQueue(content);
    console.log(`  GitHub: ${ghTasks.length} tasks (v2.0 format)`);

    // Get ClickUp tasks
    const cuTasks = await getClickUpTasks();
    console.log(`  ClickUp: ${cuTasks.length} tasks`);

    // GitHub → ClickUp
    const ghChanges = await syncGitHubToClickUp(ghTasks, cuTasks);

    // ClickUp → GitHub (re-read after potential git changes)
    const freshContent = readFileSync(TASK_QUEUE_PATH, 'utf-8');
    const { content: updatedContent, changes: cuChanges } = syncClickUpToGitHub(ghTasks, cuTasks, freshContent);

    if (cuChanges > 0) {
      writeFileSync(TASK_QUEUE_PATH, updatedContent);
      gitCommitAndPush(`Sync: ${cuChanges} status update(s) from ClickUp`);
    }

    console.log(`  Done: ${ghChanges} → ClickUp, ${cuChanges} → GitHub`);
  } catch (err) {
    console.error(`  Error: ${err.message}`);
  }
}

sync();
