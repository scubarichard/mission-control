const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjNlYmM4NS04MTYwLTQ5NDktODIzOC1jMGFiNjgwNTgxMTEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWM0MmE5ODUtMTA5Ni00ODkxLTliYzQtZGQxYTBiNDNiYjFhIiwiaWF0IjoxNzczNzE0OTgwfQ.gBSwNl_frCaOvQylr5DLQubJmRGqcT-LRJpzcTWdCP4';

async function verify() {
  const resp = await fetch('https://n8n.dakona.net/api/v1/workflows/I2Z7E4UDCIeJqmEfLRdJW', {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  const wf = await resp.json();
  const claude = wf.nodes.find(n => n.name === 'Claude Agent');
  const jb = claude.parameters.jsonBody;

  // Check the boundary: DAX section end → system close → messages
  const endMarker = 'Never make investment recommendations';
  const endIdx = jb.indexOf(endMarker);
  if (endIdx >= 0) {
    const after = jb.substring(endIdx, endIdx + 100);
    console.log('After DAX section:');
    console.log(after);
    console.log('');
  }

  // Check structure
  console.log('Has DAKONA PRODUCT:', jb.indexOf('DAKONA PRODUCT') >= 0);
  console.log('Has THE 10 WORKFLOWS:', jb.indexOf('THE 10 WORKFLOWS') >= 0);
  console.log('Has DAX Core pricing:', jb.indexOf('DAX Core') >= 0);
  console.log('Has HOW TO RESPOND:', jb.indexOf('HOW TO RESPOND') >= 0);
  console.log('Has messages field:', jb.indexOf('"messages"') >= 0);
  console.log('Has tools field:', jb.indexOf('"tools"') >= 0);

  // Check: look for bare double quotes in the DAX section
  const daxStart = jb.indexOf('DAKONA PRODUCT');
  const daxEnd = endIdx + endMarker.length;
  const daxSection = jb.substring(daxStart, daxEnd);

  // Find any " in the section (should be none — we use single quotes and unicode)
  let quotePositions = [];
  for (let i = 0; i < daxSection.length; i++) {
    if (daxSection[i] === '"') {
      quotePositions.push(i);
    }
  }
  console.log('Double quotes found in DAX section:', quotePositions.length);
  if (quotePositions.length > 0) {
    quotePositions.forEach(pos => {
      console.log('  Quote at pos', pos, ':', daxSection.substring(Math.max(0,pos-20), pos+20));
    });
  }
}

verify().catch(e => console.error(e));
