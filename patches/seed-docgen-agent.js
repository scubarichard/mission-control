/**
 * Pre-seed a "DAX Assistant" agent with the generateICPReview action
 * so advisors get document generation in every conversation without
 * manual UI setup.
 *
 * Uses replaceOne with upsert:true — always overwrites on startup.
 * Schema matches LibreChat's actual Mongoose models:
 *   packages/data-schemas/src/schema/agent.ts
 *   packages/data-schemas/src/schema/action.ts
 * Action reference format: domain---action_id
 *   (actionDomainSeparator from librechat-data-provider)
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

// LibreChat uses '---' as the domain separator in agent action references
// (actionDomainSeparator from librechat-data-provider/src/types/assistants.ts)
const ACTION_DOMAIN_SEPARATOR = '---';

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

  const openapiSpec = fs.readFileSync(SPEC_PATH, 'utf8');
  const now = new Date();

  // --- Upsert the action document ---
  // Schema: packages/data-schemas/src/schema/action.ts
  const actionsCol = db.collection('actions');
  const actionDoc = {
    user: firstUser._id,
    action_id: ACTION_ID,
    type: 'action_prototype',
    agent_id: AGENT_ID,
    metadata: {
      domain: ACTION_DOMAIN,
      raw_spec: openapiSpec,
      auth: {
        type: 'none',
      },
      api_key: '',
      privacy_policy_url: '',
    },
  };
  await actionsCol.replaceOne(
    { action_id: ACTION_ID },
    actionDoc,
    { upsert: true }
  );
  console.log('[DAX seed] Action upserted: ' + ACTION_ID + ' (domain: ' + ACTION_DOMAIN + ', type: action_prototype)');

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

  // --- Upsert the agent document ---
  // Schema: packages/data-schemas/src/schema/agent.ts
  // actions array format: "domain---action_id" (actionDomainSeparator)
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
    tools: ['actions'],
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
  console.log('[DAX seed] Agent upserted: ' + AGENT_NAME + ' (model: ' + MODEL_NAME + ', actions: [' + actionRef + '])');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[DAX seed] Fatal error:', err.message);
  console.error(err.stack);
});
