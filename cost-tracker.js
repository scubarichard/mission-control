/**
 * Task-to-Cost Attribution Tracker
 * Tags API calls with task IDs, aggregates costs, writes to ClickUp.
 *
 * Usage:
 *   import { trackCost, completeTask, getTaskCost, getAllCosts } from './cost-tracker.js';
 *
 *   trackCost({ taskId: 'TASK-20260401-007', model: 'sonnet', inputTokens: 1500, outputTokens: 800 });
 *   const summary = await completeTask('TASK-20260401-007');  // aggregates + writes to ClickUp
 *
 * ENV:
 *   CLICKUP_API_KEY — for writing costs to ClickUp
 *   COST_LOG_PATH   — path to persist cost log (default: ./cost-log.json)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

const COST_LOG_PATH = process.env.COST_LOG_PATH || './cost-log.json';
const API_KEY = process.env.CLICKUP_API_KEY || '';

// Pricing per 1M tokens (as of 2026-04)
const MODEL_PRICING = {
  'opus':   { input: 15.00, output: 75.00 },
  'sonnet': { input: 3.00,  output: 15.00 },
  'haiku':  { input: 0.25,  output: 1.25  },
  'gpt-4o': { input: 2.50,  output: 10.00 },
};

// --- Storage ---

function loadLog() {
  if (existsSync(COST_LOG_PATH)) {
    return JSON.parse(readFileSync(COST_LOG_PATH, 'utf-8'));
  }
  return { events: [], taskSummaries: {} };
}

function saveLog(log) {
  writeFileSync(COST_LOG_PATH, JSON.stringify(log, null, 2));
}

// --- Cost calculation ---

function calculateCost(model, inputTokens, outputTokens) {
  const pricing = MODEL_PRICING[model.toLowerCase()] || MODEL_PRICING.sonnet;
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

// --- Public API ---

/**
 * Track a single API call cost event.
 */
export function trackCost({ taskId, model, inputTokens, outputTokens, agent, client, note }) {
  const log = loadLog();
  const cost = calculateCost(model, inputTokens, outputTokens);

  log.events.push({
    taskId,
    model,
    inputTokens,
    outputTokens,
    cost,
    agent: agent || '',
    client: client || '',
    note: note || '',
    timestamp: new Date().toISOString(),
  });

  saveLog(log);
  return cost;
}

/**
 * Get aggregated cost for a task.
 */
export function getTaskCost(taskId) {
  const log = loadLog();
  const events = log.events.filter(e => e.taskId === taskId);
  const totalCost = events.reduce((s, e) => s + e.cost, 0);
  const totalInput = events.reduce((s, e) => s + e.inputTokens, 0);
  const totalOutput = events.reduce((s, e) => s + e.outputTokens, 0);
  const models = [...new Set(events.map(e => e.model))];

  return { taskId, totalCost, totalInput, totalOutput, models, eventCount: events.length };
}

/**
 * Get all costs grouped by task.
 */
export function getAllCosts() {
  const log = loadLog();
  const taskIds = [...new Set(log.events.map(e => e.taskId))];
  return taskIds.map(id => getTaskCost(id));
}

/**
 * Get costs grouped by client.
 */
export function getCostsByClient() {
  const log = loadLog();
  const clients = {};
  for (const event of log.events) {
    const client = event.client || 'untagged';
    if (!clients[client]) clients[client] = { totalCost: 0, events: 0 };
    clients[client].totalCost += event.cost;
    clients[client].events++;
  }
  return clients;
}

/**
 * Mark a task complete: aggregate costs and optionally write to ClickUp.
 * Returns the task summary.
 */
export async function completeTask(taskId, { clickupTaskId, revenue } = {}) {
  const summary = getTaskCost(taskId);
  summary.completedAt = new Date().toISOString();

  if (revenue) {
    summary.revenue = revenue;
    summary.margin = ((revenue - summary.totalCost) / revenue * 100).toFixed(1);
  }

  // Save summary
  const log = loadLog();
  log.taskSummaries[taskId] = summary;
  saveLog(log);

  // Write to ClickUp if we have the task ID and API key
  if (clickupTaskId && API_KEY) {
    try {
      const res = await fetch(`https://api.clickup.com/api/v2/task/${clickupTaskId}`, {
        method: 'PUT',
        headers: { Authorization: API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description_append: `\n\n---\n**Cost Summary**\n- Total: $${summary.totalCost.toFixed(4)}\n- Input tokens: ${summary.totalInput.toLocaleString()}\n- Output tokens: ${summary.totalOutput.toLocaleString()}\n- Models: ${summary.models.join(', ')}\n- API calls: ${summary.eventCount}${summary.margin ? `\n- Revenue: $${revenue}\n- Margin: ${summary.margin}%` : ''}`,
        }),
      });
      if (!res.ok) console.error(`ClickUp update failed: ${res.status}`);
    } catch (err) {
      console.error(`ClickUp write error: ${err.message}`);
    }
  }

  return summary;
}
