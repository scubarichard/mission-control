/**
 * Pre-seed a "DAX Assistant" agent with the generateICPReview action
 * so advisors get document generation in every conversation without
 * manual UI setup.
 *
 * Uses replaceOne with upsert:true — always overwrites the agent
 * document on every startup to ensure model name, instructions,
 * and action config are current.
 *
 * Requires MONGO_URI environment variable.
 */

const fs = require('fs');
const mongoose = require('mongoose');

const AGENT_ID = 'agent_dax_main';
const ACTION_ID = 'action_dax_docgen';
const AGENT_NAME = 'DAX Assistant';
const SPEC_PATH = '/app/patches/openapi-docgen.yaml';

// Must match a model key in azureOpenAI groups config in librechat.yaml.
// The groups config must have "gpt-4o": { deploymentName: "gpt-4o" }.
const MODEL_NAME = 'gpt-4o';

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

  // Need a user as author — use the first existing user
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
  const actionsCol = db.collection('actions');
  const actionDoc = {
    action_id: ACTION_ID,
    user: firstUser._id,
    type: 'action',
    domain: 'n8n.dakona.net',
    metadata: {
      api_key: '',
      auth_type: 'none',
      name_for_human: 'DAX Document Services',
      name_for_model: 'daxDocumentServices',
      description_for_human: 'Generates ICP review documents and saves uploaded files to SharePoint',
      description_for_model: 'Generates ICP quarterly review documents (generateICPReview) and saves uploaded source documents to SharePoint client folders (saveClientDocument). Routes through n8n which handles Graph API auth.',
      privacy_policy_url: '',
      legal_info_url: '',
    },
    openapi_spec: openapiSpec,
    updatedAt: now,
    createdAt: now,
  };
  await actionsCol.replaceOne(
    { action_id: ACTION_ID },
    actionDoc,
    { upsert: true }
  );
  console.log('[DAX seed] Action "' + ACTION_ID + '" upserted');

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
    actions: [ACTION_ID],
    tool_resources: {},
    isCollaborative: true,
    projectIds: [],
    hide: false,
    createdAt: now,
    updatedAt: now,
  };
  await agentsCol.replaceOne(
    { id: AGENT_ID },
    agentDoc,
    { upsert: true }
  );
  console.log('[DAX seed] Agent "' + AGENT_NAME + '" upserted (model: ' + MODEL_NAME + ', provider: azureOpenAI)');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[DAX seed] Fatal error:', err.message);
  console.error(err.stack);
});
