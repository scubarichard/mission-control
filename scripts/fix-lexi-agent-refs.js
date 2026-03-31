#!/usr/bin/env node
/**
 * Fix Lexi AI Agent — Claude Agent node references $json which breaks
 * when flow goes through Slack node (Slack output replaces $json context).
 * Fix: reference $('Prepare Context').item.json instead of $json.
 */

const N8N_URL = process.env.N8N_URL || 'https://n8n.dakona.net';
const N8N_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const WORKFLOW_ID = 'rOeIlAJDI1iL7SBF-eEQv';

async function main() {
  // 1. Get workflow
  const getRes = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    headers: { 'Accept': 'application/json', 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await getRes.json();
  console.log('Workflow:', wf.name);

  // 2. Find Claude Agent node
  const agentIdx = wf.nodes.findIndex(n => n.name === 'Claude Agent');
  if (agentIdx === -1) { console.error('Claude Agent node not found!'); process.exit(1); }

  const oldBody = wf.nodes[agentIdx].parameters.jsonBody;

  // Count existing $json references
  const jsonRefs = oldBody.match(/\$json\./g) || [];
  console.log(`Found ${jsonRefs.length} $json references in jsonBody`);

  // 3. Replace $json.xxx with $('Prepare Context').item.json.xxx
  const PC = "$('Prepare Context').item.json";
  let newBody = oldBody;

  // Replace {{ $json.contact_name }}
  newBody = newBody.replaceAll('$json.contact_name', `${PC}.contact_name`);

  // Replace {{ $json.contact_email || 'no email yet' }}
  newBody = newBody.replaceAll('$json.contact_email', `${PC}.contact_email`);

  // Replace {{ $json.lexi_state }}
  newBody = newBody.replaceAll('$json.lexi_state', `${PC}.lexi_state`);

  // Replace {{ $json.is_existing_contact }}
  newBody = newBody.replaceAll('$json.is_existing_contact', `${PC}.is_existing_contact`);

  // Replace JSON.stringify($json.messages)
  newBody = newBody.replaceAll('$json.messages', `${PC}.messages`);

  // Check results
  const newJsonRefs = newBody.match(/\$json\./g) || [];
  const pcRefs = newBody.match(/Prepare Context/g) || [];
  console.log(`After fix: ${newJsonRefs.length} $json refs remaining, ${pcRefs.length} Prepare Context refs`);

  if (oldBody === newBody) {
    console.log('WARNING: No changes detected!');
    console.log('First 500 chars of body:', oldBody.substring(0, 500));
    process.exit(1);
  }

  // 4. Update workflow
  wf.nodes[agentIdx].parameters.jsonBody = newBody;

  const putRes = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings || {} })
  });

  const result = await putRes.json();
  if (result.name) {
    console.log(`Updated workflow: ${result.name}`);

    // Verify the fix
    const verifyAgent = result.nodes.find(n => n.name === 'Claude Agent');
    const remaining = verifyAgent.parameters.jsonBody.match(/\$json\./g) || [];
    const pcCount = verifyAgent.parameters.jsonBody.match(/Prepare Context/g) || [];
    console.log(`Verified: ${remaining.length} $json refs, ${pcCount.length} Prepare Context refs`);
  } else {
    console.error('Update failed:', JSON.stringify(result).substring(0, 300));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
