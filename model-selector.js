/**
 * Atlas Auto Model Selector
 * Classifies task complexity and selects the optimal model.
 *
 * Tiers:
 *   Haiku  — Simple: status checks, grep, git operations, polling, one-liners
 *   Sonnet — Standard: code generation, data imports, API integrations, debugging
 *   Opus   — Complex: architecture decisions, multi-step reasoning, planning, novel problems
 *
 * Saves 60-80% on API costs by defaulting to Haiku for routine work.
 *
 * Usage:
 *   import { selectModel, MODEL_TIERS } from './model-selector.js';
 *   const { model, tier, reason } = selectModel(taskDescription);
 */

const MODEL_TIERS = {
  haiku: {
    id: 'anthropic/claude-haiku-4-5-20251001',
    costPer1MInput: 0.25,
    costPer1MOutput: 1.25,
    tier: 'haiku',
  },
  sonnet: {
    id: 'anthropic/claude-sonnet-4-6',
    costPer1MInput: 3.00,
    costPer1MOutput: 15.00,
    tier: 'sonnet',
  },
  opus: {
    id: 'anthropic/claude-opus-4-6',
    costPer1MInput: 15.00,
    costPer1MOutput: 75.00,
    tier: 'opus',
  },
};

// --- Classification patterns ---

const HAIKU_PATTERNS = [
  // Task queue polling
  /poll|heartbeat|ping|health.?check|status.?check/i,
  // Simple git operations
  /git pull|git push|git status|git add|git commit/i,
  // Grep/search operations
  /^grep|^search|^find|^list|^check|^verify/i,
  // Simple status reports
  /no pending|nothing found|queue empty/i,
  // Acknowledgements
  /mark.*done|mark.*complete|mark.*in.?progress/i,
  // Cron/scheduling
  /cron|schedule|timer|interval/i,
  // Simple file reads
  /^read|^cat|^show|^display/i,
  // Notifications
  /send.*message|post.*slack|post.*telegram|notify/i,
];

const OPUS_PATTERNS = [
  // Architecture and planning
  /architect|design|plan.*implement|system.*design/i,
  // Complex multi-step reasoning
  /multi.?step|complex|refactor.*entire|redesign/i,
  // Novel problem solving
  /investigate|diagnose.*root|debug.*complex|troubleshoot/i,
  // Security and compliance
  /security.*audit|compliance|vulnerability/i,
  // Strategic decisions
  /strategy|prioriti[zs]|trade.?off|decision.*matrix/i,
  // Large-scale changes
  /migration|large.?scale|overhaul|rewrite/i,
];

/**
 * Classify a task description and return the optimal model.
 */
function selectModel(taskDescription) {
  if (!taskDescription || taskDescription.trim().length === 0) {
    return { ...MODEL_TIERS.haiku, reason: 'empty/no task — default to cheapest' };
  }

  const desc = taskDescription.trim();

  // Short tasks (< 50 chars) are almost always simple
  if (desc.length < 50) {
    for (const pattern of HAIKU_PATTERNS) {
      if (pattern.test(desc)) {
        return { ...MODEL_TIERS.haiku, reason: `simple task: matched "${pattern.source}"` };
      }
    }
  }

  // Check for Opus-level complexity first
  for (const pattern of OPUS_PATTERNS) {
    if (pattern.test(desc)) {
      return { ...MODEL_TIERS.opus, reason: `complex task: matched "${pattern.source}"` };
    }
  }

  // Check for Haiku-level simplicity
  for (const pattern of HAIKU_PATTERNS) {
    if (pattern.test(desc)) {
      return { ...MODEL_TIERS.haiku, reason: `simple task: matched "${pattern.source}"` };
    }
  }

  // Default: Sonnet for everything else
  return { ...MODEL_TIERS.sonnet, reason: 'standard complexity — default tier' };
}

/**
 * Estimate cost savings vs always using Opus.
 */
function estimateSavings(selectedTier, inputTokens = 5000, outputTokens = 2000) {
  const selected = MODEL_TIERS[selectedTier];
  const opus = MODEL_TIERS.opus;

  const selectedCost = (inputTokens / 1e6) * selected.costPer1MInput +
                       (outputTokens / 1e6) * selected.costPer1MOutput;
  const opusCost = (inputTokens / 1e6) * opus.costPer1MInput +
                   (outputTokens / 1e6) * opus.costPer1MOutput;

  return {
    selectedCost,
    opusCost,
    saved: opusCost - selectedCost,
    savingsPercent: ((opusCost - selectedCost) / opusCost * 100).toFixed(1),
  };
}

export { selectModel, estimateSavings, MODEL_TIERS };
