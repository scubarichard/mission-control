#!/usr/bin/env node
/**
 * CLI cost logger — called by agents after task completion
 * Usage: node log-cost.js --task TASK-ID --model sonnet --input 1500 --output 800 --agent Nautilus --client PNT
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const COST_LOG_PATH = process.env.COST_LOG_PATH || resolve(dirname(fileURLToPath(import.meta.url)), 'cost-log.json');

const MODEL_PRICING = {
  'opus':   { input: 15.00, output: 75.00 },
  'sonnet': { input: 3.00,  output: 15.00 },
  'haiku':  { input: 0.25,  output: 1.25  },
};

function loadLog() {
  if (existsSync(COST_LOG_PATH)) return JSON.parse(readFileSync(COST_LOG_PATH, 'utf-8'));
  return { events: [], taskSummaries: {} };
}

function saveLog(log) {
  writeFileSync(COST_LOG_PATH, JSON.stringify(log, null, 2));
}

// Parse args
const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i+1] : null; };

const taskId    = get('--task');
const model     = (get('--model') || 'sonnet').toLowerCase();
const input     = parseInt(get('--input') || '0');
const output    = parseInt(get('--output') || '0');
const agent     = get('--agent') || '';
const client    = get('--client') || '';
const note      = get('--note') || '';

if (!taskId) { console.error('Usage: node log-cost.js --task TASK-ID --model sonnet --input N --output N [--agent X] [--client X]'); process.exit(1); }

const pricing = MODEL_PRICING[model] || MODEL_PRICING.sonnet;
const cost = (input / 1_000_000) * pricing.input + (output / 1_000_000) * pricing.output;

const log = loadLog();
log.events.push({ taskId, model, inputTokens: input, outputTokens: output, cost, agent, client, note, timestamp: new Date().toISOString() });

// Update task summary
const events = log.events.filter(e => e.taskId === taskId);
log.taskSummaries[taskId] = {
  taskId,
  totalCost: events.reduce((s,e) => s + e.cost, 0),
  totalInput: events.reduce((s,e) => s + e.inputTokens, 0),
  totalOutput: events.reduce((s,e) => s + e.outputTokens, 0),
  models: [...new Set(events.map(e => e.model))],
  agent, client,
  eventCount: events.length,
  updatedAt: new Date().toISOString(),
};

saveLog(log);
console.log(`Logged: ${taskId} | ${model} | in:${input} out:${output} | $${cost.toFixed(5)} | agent:${agent} client:${client}`);
