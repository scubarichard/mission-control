/**
 * Pre-seed a "DAX Assistant" agent with the generateICPReview and
 * saveClientDocument actions so advisors get document generation
 * in every conversation without manual UI setup.
 *
 * Uses replaceOne with upsert:true — always overwrites on startup.
 *
 * Schema sources (LibreChat GitHub):
 *   packages/data-schemas/src/schema/agent.ts
 *   packages/data-schemas/src/schema/action.ts
 *   packages/data-provider/src/types/assistants.ts
 *
 * Key constants from librechat-data-provider:
 *   actionDelimiter = '_action_'     (between function name and encoded domain)
 *   actionDomainSeparator = '---'    (replaces dots in domain for tool names)
 *
 * Tool name format in agent.tools:
 *   {operationId}_action_{domain with dots replaced by ---}
 *   e.g. generateICPReview_action_n8n---dakona---net
 *
 * Action loading flow (from ToolService.js):
 *   1. Load actions where action.agent_id === agent.id
 *   2. Parse each action's metadata.raw_spec (JSON OpenAPI)
 *   3. For each entry in agent.tools matching _action_ pattern,
 *      find the matching function and create a callable tool
 *
 * Requires MONGO_URI environment variable.
 */

const fs = require('fs');
const mongoose = require('mongoose');

const AGENT_ID = 'agent_dax_main';
const ACTION_ID = 'action_dax_docgen';
const ACTION_DOMAIN = 'n8n.dakona.net';
const AGENT_NAME = 'DAX Assistant';
const SPEC_PATH = '/app/patches/openapi-docgen.yaml';
const MODEL_NAME = 'gpt-4o';

// LibreChat constants (from librechat-data-provider/src/types/assistants.ts)
const ACTION_DELIMITER = '_action_';
const ACTION_DOMAIN_SEPARATOR = '---';

// Encode domain for tool names: n8n.dakona.net -> n8n---dakona---net
function encodeDomain(domain) {
  return domain.replace(/\./g, ACTION_DOMAIN_SEPARATOR);
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('[DAX seed] MONGO_URI not set, skipping');
    return;
  }

  if (!fs.existsSync(SPEC_PATH)) {
    console.error('[DAX seed] OpenAPI spec not found at ' + SPEC_PATH);
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log('[DAX seed] Connected to MongoDB');
  } catch (err) {
    console.error('[DAX seed] DB connect failed:', err.message);
    return;
  }

  const db = mongoose.connection.db;

  // Need a user as author
  const usersCol = db.collection('users');
  const firstUser = await usersCol.findOne({});
  if (!firstUser) {
    console.error('[DAX seed] No users exist yet — will seed on next restart after first login');
    await mongoose.disconnect();
    return;
  }
  console.log('[DAX seed] Using author: ' + (firstUser.email || firstUser.username || firstUser._id));

  // Read and convert OpenAPI spec from YAML to JSON
  // (metadata.raw_spec must be JSON per LibreChat's validateAndParseOpenAPISpec)
  const yamlSpec = fs.readFileSync(SPEC_PATH, 'utf8');
  let jsonSpec;
  try {
    const yaml = require('js-yaml');
    const parsed = yaml.load(yamlSpec);
    jsonSpec = JSON.stringify(parsed);
    console.log('[DAX seed] OpenAPI spec parsed: ' + jsonSpec.length + ' chars JSON');
  } catch (err) {
    console.error('[DAX seed] Failed to parse OpenAPI YAML:', err.message);
    await mongoose.disconnect();
    return;
  }

  const now = new Date();

  // --- Upsert the action document ---
  // Schema: packages/data-schemas/src/schema/action.ts
  // The agent_id field links this action to our agent (used by loadActionSets)
  const actionsCol = db.collection('actions');
  const actionDoc = {
    user: firstUser._id,
    action_id: ACTION_ID,
    type: 'action_prototype',
    agent_id: AGENT_ID,
    metadata: {
      domain: ACTION_DOMAIN,
      raw_spec: jsonSpec,
      auth: {
        type: 'none',
      },
    },
  };
  await actionsCol.deleteMany({ agent_id: AGENT_ID, action_id: { $ne: ACTION_ID } });
  console.log([DAX seed] Cleared conflicting UI actions);

  await actionsCol.replaceOne(
    { action_id: ACTION_ID },
    actionDoc,
    { upsert: true }
  );
  console.log('[DAX seed] Action upserted: ' + ACTION_ID + ' (domain: ' + ACTION_DOMAIN + ')');

  // --- Read the system prompt from config ---
  let instructions = '';
  try {
    const yaml = require('js-yaml');
    const config = yaml.load(fs.readFileSync('/config/librechat.yaml', 'utf8'));
    instructions = config?.endpoints?.azureOpenAI?.systemPrompt || '';
    console.log('[DAX seed] System prompt loaded (' + instructions.length + ' chars)');
  } catch (err) {
    console.error('[DAX seed] Could not read config:', err.message);
  }

  // --- Build tool names for agent.tools ---
  // Format: {operationId}_action_{encodedDomain}
  // ToolService.js uses these to match against parsed OpenAPI operations
  const encodedDomain = encodeDomain(ACTION_DOMAIN);
  const toolNames = [
    'actions',  // capability flag — tells LibreChat this agent uses actions
    'generateICPReview' + ACTION_DELIMITER + encodedDomain,
    'saveClientDocument' + ACTION_DELIMITER + encodedDomain,
  ];
  console.log('[DAX seed] Tool names: ' + JSON.stringify(toolNames));

  // --- Upsert the agent document ---
  // Schema: packages/data-schemas/src/schema/agent.ts
  // agent.tools contains the specific action tool names (not just 'actions')
  // agent.actions is legacy — kept for backward compat but tools is authoritative
  const actionRef = ACTION_DOMAIN + ACTION_DOMAIN_SEPARATOR + ACTION_ID;
  const agentsCol = db.collection('agents');
  const agentDoc = {
    id: AGENT_ID,
    author: firstUser._id,
    name: AGENT_NAME,
    description: 'Governed AI for RIAs — GPT-4o with document generation and SharePoint file management',
    instructions: instructions,
    model: MODEL_NAME,
    provider: 'azureOpenAI',
    tools: toolNames,
    actions: [actionRef],
    tool_resources: {},
    isCollaborative: true,
    projectIds: [],
    versions: [],
    category: 'general',
    mcpServerNames: [],
    createdAt: now,
    updatedAt: now,
  };
  await agentsCol.replaceOne(
    { id: AGENT_ID },
    agentDoc,
    { upsert: true }
  );
  console.log('[DAX seed] Agent upserted: ' + AGENT_NAME);
  console.log('[DAX seed]   model: ' + MODEL_NAME + ', provider: azureOpenAI');
  console.log('[DAX seed]   tools: ' + JSON.stringify(toolNames));
  console.log('[DAX seed]   actions: [' + actionRef + ']');

  // --- Read back and verify what's actually persisted in MongoDB ---
  const savedAgent = await agentsCol.findOne({ id: AGENT_ID });
  if (savedAgent) {
    console.log('[DAX seed] Agent verified: tools = ' + JSON.stringify(savedAgent.tools));
  } else {
    console.error('[DAX seed] Agent verification FAILED: not found after upsert');
  }

  const savedAction = await actionsCol.findOne({ action_id: ACTION_ID });
  if (savedAction) {
    console.log('[DAX seed] Action verified: metadata.domain = ' + (savedAction.metadata && savedAction.metadata.domain));
  } else {
    console.error('[DAX seed] Action verification FAILED: not found after upsert');
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[DAX seed] Fatal error:', err.message);
  console.error(err.stack);
});
