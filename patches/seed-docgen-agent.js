/**
 * Pre-seed a "DAX Assistant" agent with the generateICPReview and
 * saveClientDocument actions so advisors get document generation
 * in every conversation without manual UI setup.
 *
 * Uses replaceOne with upsert:true — always overwrites on startup.
 *
 * CRITICAL: Tool name encoding
 *   LibreChat's ToolService generates tool names at runtime by base64-encoding
 *   the full action URL (https://domain) and using that as the suffix:
 *     {operationId}_action_{base64(https://domain)}
 *   e.g. generateICPReview_action_aHR0cHM6Ly9uOG4uZGFrb25hLm5ldA==
 *
 * CRITICAL: raw_spec format
 *   LibreChat's ActionService/ToolService expects raw_spec to be stored as
 *   the original YAML string (not JSON.stringify'd). It passes raw_spec
 *   directly to validateAndParseOpenAPISpec which handles YAML parsing.
 *   Storing as JSON string breaks the parsing pipeline.
 *
 * CRITICAL: auth structure
 *   UI-created actions store auth as { type: 'none' } at top level of metadata.
 *   ToolService checks metadata.auth.type to determine auth handling.
 *
 * Requires MONGO_URI environment variable.
 */

const fs = require('fs');
const mongoose = require('mongoose');

const AGENT_ID = 'agent_dax_main';
const ACTION_ID = 'action_dax_docgen';
const ACTION_DOMAIN = 'n8n.dakona.net';
const ACTION_URL = 'https://' + ACTION_DOMAIN;
const AGENT_NAME = 'DAX Assistant';
const SPEC_PATH = '/app/patches/openapi-docgen.yaml';
const MODEL_NAME = 'gpt-4o';

const ACTION_DELIMITER = '_action_';

// Encode domain the same way LibreChat's ToolService does at runtime:
// base64 of the full URL (https://domain)
function encodeActionDomain(url) {
  return Buffer.from(url).toString('base64');
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

  // Read the raw YAML spec — store as-is, NOT as JSON.stringify
  // LibreChat's validateAndParseOpenAPISpec handles YAML parsing at runtime
  const yamlSpec = fs.readFileSync(SPEC_PATH, 'utf8');
  console.log('[DAX seed] OpenAPI spec loaded: ' + yamlSpec.length + ' chars YAML');

  // Validate it parses correctly (but don't store the parsed version)
  try {
    const yaml = require('js-yaml');
    const parsed = yaml.load(yamlSpec);
    const paths = Object.keys(parsed.paths || {});
    console.log('[DAX seed] OpenAPI spec valid — paths: ' + JSON.stringify(paths));
  } catch (err) {
    console.error('[DAX seed] Failed to validate OpenAPI YAML:', err.message);
    await mongoose.disconnect();
    return;
  }

  const now = new Date();
  const actionsCol = db.collection('actions');

  // --- Clean up ALL existing actions for this agent ---
  const deleteResult = await actionsCol.deleteMany({ agent_id: AGENT_ID });
  if (deleteResult.deletedCount > 0) {
    console.log('[DAX seed] Cleared ' + deleteResult.deletedCount + ' existing action(s) for agent');
  }

  // --- Upsert the action document ---
  // Structure matches what LibreChat UI creates:
  // - raw_spec is the YAML string (NOT JSON.stringify'd)
  // - domain is just the hostname (no protocol)
  // - auth.type = 'none' for no authentication
  const actionDoc = {
    user: firstUser._id,
    action_id: ACTION_ID,
    type: 'action_prototype',
    agent_id: AGENT_ID,
    metadata: {
      domain: ACTION_DOMAIN,
      raw_spec: yamlSpec,
      auth: { type: 'none' },
    },
  };
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

  // --- Build tool names using base64 encoding (matches LibreChat ToolService runtime) ---
  const encodedDomain = encodeActionDomain(ACTION_URL);
  console.log('[DAX seed] Encoded domain: ' + encodedDomain + ' (from ' + ACTION_URL + ')');

  const toolNames = [
    'actions',
    'generateICPReview' + ACTION_DELIMITER + encodedDomain,
    'saveClientDocument' + ACTION_DELIMITER + encodedDomain,
  ];
  console.log('[DAX seed] Tool names: ' + JSON.stringify(toolNames));

  // --- Upsert the agent document ---
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
    actions: [ACTION_ID],
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

  // --- Verify ---
  const savedAgent = await agentsCol.findOne({ id: AGENT_ID });
  if (savedAgent) {
    console.log('[DAX seed] Agent verified: tools = ' + JSON.stringify(savedAgent.tools));
  } else {
    console.error('[DAX seed] Agent verification FAILED');
  }

  const savedAction = await actionsCol.findOne({ action_id: ACTION_ID });
  if (savedAction) {
    console.log('[DAX seed] Action verified: domain=' + savedAction.metadata.domain);
    console.log('[DAX seed]   raw_spec first 80 chars: ' + savedAction.metadata.raw_spec.substring(0, 80).replace(/\n/g, '\\n'));
  }

  const allActions = await actionsCol.find({ agent_id: AGENT_ID }).toArray();
  console.log('[DAX seed] Total actions for agent: ' + allActions.length);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[DAX seed] Fatal error:', err.message);
  console.error(err.stack);
});
