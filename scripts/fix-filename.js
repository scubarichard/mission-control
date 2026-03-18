// Fix filename in DAX Document Generator Fill Placeholders node
// Bug: uses data.CLIENT_NAME but data has clientName (camelCase) 
// Fix: use data.clientName || templateData.CLIENT_NAME

const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';
const N8N_URL = 'https://n8n.dakona.net';

async function fixFilename() {
  // Get current workflow
  const resp = await fetch(`${N8N_URL}/api/v1/workflows/MtkxBYcyV1VYt02e`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();
  
  const fillNode = wf.nodes.find(n => n.name === 'Fill Placeholders');
  if (!fillNode) { console.error('Fill Placeholders node not found'); return; }
  
  // Check current filename line
  const currentCode = fillNode.parameters.jsCode;
  console.log('Current filename line:', currentCode.match(/const fileName.*/)?.[0] || 'not found');
  
  // Fix: use camelCase clientName and reportPeriod from data object
  const fixedCode = currentCode.replace(
    /const fileName = .*\.docx';/,
    "const fileName = ((data.clientName || templateData.CLIENT_NAME || 'Report').replace(/[^a-zA-Z0-9\\s\\-]/g, '').trim() || 'Report') + '-' + ((data.reportPeriod || templateData.REPORT_PERIOD || 'Report').replace(/[^a-zA-Z0-9\\s\\-]/g, '').trim() || 'Report') + '.docx';"
  );
  
  console.log('New filename line:', fixedCode.match(/const fileName.*/)?.[0] || 'not found');
  
  if (currentCode === fixedCode) {
    console.log('No change needed or pattern not matched - trying alternative approach');
    // Try a different approach - add line before the existing one
    const insertPoint = currentCode.indexOf('\nreturn [{');
    if (insertPoint === -1) {
      console.error('Cannot find insertion point');
      return;
    }
    // Already has fix or different format - skip
    console.log('Current code around fileName:', currentCode.substring(currentCode.indexOf('fileName') - 10, currentCode.indexOf('fileName') + 200));
    return;
  }
  
  // Update the node
  const nodes = wf.nodes.map(n => {
    if (n.name === 'Fill Placeholders') {
      n.parameters.jsCode = fixedCode;
    }
    return n;
  });
  
  const updateResp = await fetch(`${N8N_URL}/api/v1/workflows/MtkxBYcyV1VYt02e`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY },
    body: JSON.stringify({ 
      name: wf.name, 
      nodes, 
      connections: wf.connections, 
      settings: { executionOrder: 'v1' }
    })
  });
  
  const result = await updateResp.json();
  if (result.message) {
    console.error('Update error:', result.message);
  } else {
    console.log('Filename fix applied successfully. Workflow updated:', result.id);
  }
}

fixFilename().catch(e => console.error('ERROR:', e.message));
