/**
 * Pre-seed a "DAX Assistant" agent with the generateICPReview action
 * so advisors get document generation in every conversation without
 * manual UI setup.
 *
 * Runs at container startup (idempotent — skips if agent already exists).
 * Requires MONGO_URI environment variable.
 */

const fs = require('fs');
const mongoose = require('mongoose');

const AGENT_ID = 'agent_dax_main';
const ACTION_ID = 'action_dax_docgen';
const AGENT_NAME = 'DAX Assistant';
const SPEC_PATH = '/app/patches/openapi-docgen.yaml';

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.log('[DAX] MONGO_URI not set, skipping agent seed');
    return;
  }

  if (!fs.existsSync(SPEC_PATH)) {
    console.log('[DAX] OpenAPI spec not found at ' + SPEC_PATH + ', skipping agent seed');
    return;
  }

  try {
    await mongoose.connect(uri);
  } catch (err) {
    console.error('[DAX] Cannot connect to DB, skipping agent seed:', err.message);
    return;
  }

  const db = mongoose.connection.db;

  // Check if agent already exists
  const agentsCol = db.collection('agents');
  const existing = await agentsCol.findOne({ id: AGENT_ID });
  if (existing) {
    console.log('[DAX] Agent "' + AGENT_NAME + '" already exists (id: ' + AGENT_ID + ')');
    await mongoose.disconnect();
    return;
  }

  // Need a user as author — use the first existing user
  const usersCol = db.collection('users');
  const firstUser = await usersCol.findOne({});
  if (!firstUser) {
    console.log('[DAX] No users exist yet — agent will be seeded on next restart after first login');
    await mongoose.disconnect();
    return;
  }

  const openapiSpec = fs.readFileSync(SPEC_PATH, 'utf8');
  const now = new Date();

  // Upsert the action document (always update spec so new operations are picked up)
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
  };
  const actionResult = await actionsCol.updateOne(
    { action_id: ACTION_ID },
    { $set: actionDoc, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
  if (actionResult.upsertedCount) {
    console.log('[DAX] Created action "' + ACTION_ID + '"');
  } else if (actionResult.modifiedCount) {
    console.log('[DAX] Updated action "' + ACTION_ID + '" with latest OpenAPI spec');
  } else {
    console.log('[DAX] Action "' + ACTION_ID + '" unchanged');
  }

  // Read config from the YAML-injected config file
  let instructions = '';
  let modelName = 'gpt-4o'; // Must match a model key in azureOpenAI groups config
  try {
    const yaml = require('js-yaml');
    const config = yaml.load(fs.readFileSync('/config/librechat.yaml', 'utf8'));
    instructions = config?.endpoints?.azureOpenAI?.systemPrompt || '';
    // Extract the model alias from the azureOpenAI groups config
    const groups = config?.endpoints?.azureOpenAI?.groups;
    if (groups && groups[0] && groups[0].models) {
      const aliases = Object.keys(groups[0].models);
      if (aliases.length > 0) {
        modelName = aliases[0];
        console.log('[DAX] Using model alias from config: ' + modelName);
      }
    }
  } catch {
    console.log('[DAX] Could not read config, using defaults');
  }

  // Create the agent document
  // model must be the LibreChat alias (e.g. "DAX Assistant"), not the
  // Azure deployment name (e.g. "gpt-4o"), because LibreChat resolves
  // the alias to the deployment via the azureOpenAI groups config.
  await agentsCol.insertOne({
    id: AGENT_ID,
    author: firstUser._id,
    name: AGENT_NAME,
    description: 'Governed AI for RIAs — GPT-4o with document generation and SharePoint file management',
    instructions: instructions,
    model: modelName,
    provider: 'azureOpenAI',
    tools: ['actions'],
    actions: [ACTION_ID],
    tool_resources: {},
    isCollaborative: true,
    projectIds: [],
    hide: false,
    createdAt: now,
    updatedAt: now,
  });

  console.log('[DAX] Created agent "' + AGENT_NAME + '" (id: ' + AGENT_ID + ') with generateICPReview + saveClientDocument actions');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[DAX] Agent seed error:', err.message);
});
