/**
 * Generate failed reports for Tony Stark and Norman Osborn using file-based curl
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');

const clients = [
  {
    clientName: "Tony Stark",
    accountNumber: "ICP-3000-TS",
    accountType: "Taxable Brokerage",
    riskProfile: "Aggressive Growth",
    meetingDate: "2026-03-10",
    meetingLocation: "Zoom",
    attendees: "Demo Advisor, Tony Stark",
    meetingDuration: "60",
    portfolioValue: "500000000",
    ytdReturn: "8.5%",
    benchmarkReturn: "7.2%",
    vsBenchmark: "+1.3%",
    discussionPoint1: "Stark Industries IPO proceeds allocation",
    discussionPoint2: "Arc reactor technology patent royalties",
    discussionPoint3: "Defense contract revenue concentration risk",
    advisorNotes: "Client interested in increasing alternative investment allocation",
    goal1: "Preserve Stark Industries controlling interest",
    goal2: "Fund Iron Man R&D at $50M annually",
    goal3: "Establish $200M philanthropic endowment",
    goalsProgressNotes: "On track across all three goals",
    action1: "Review Stark Industries equity concentration",
    action1Owner: "Demo Advisor",
    action1Due: "2026-04-15",
    action2: "Model alternative investment allocation",
    action2Owner: "Demo Advisor",
    action2Due: "2026-04-30",
    action3: "Draft endowment structure proposal",
    action3Owner: "Tony Stark",
    action3Due: "2026-05-01",
    nextMeetingDate: "2026-06-15",
    nextMeetingAgenda: "Q2 review, alternative investment proposal, endowment planning",
    firmName: "Demo Firm",
    reportPeriod: "Q1 2026",
    reportDate: "2026-03-16",
    advisorName: "Demo Advisor"
  },
  {
    clientName: "Norman Osborn",
    accountNumber: "ICP-0066-NO",
    accountType: "Taxable Brokerage",
    riskProfile: "Moderate Growth",
    meetingDate: "2026-03-13",
    meetingLocation: "Zoom",
    attendees: "Demo Advisor, Norman Osborn",
    meetingDuration: "60",
    portfolioValue: "4200000000",
    ytdReturn: "6.1%",
    benchmarkReturn: "5.8%",
    vsBenchmark: "+0.3%",
    discussionPoint1: "Oscorp Industries R&D investment allocation",
    discussionPoint2: "Defense contract pipeline and revenue timing",
    discussionPoint3: "Estate planning for Harry Osborn inheritance",
    advisorNotes: "Client expressed interest in accelerating estate transfer to son",
    goal1: "Maintain Oscorp R&D leadership in biotech",
    goal2: "Grow defense revenue to 40% of total Oscorp revenue",
    goal3: "Complete estate plan transfer to Harry within 3 years",
    goalsProgressNotes: "Biotech R&D on track; defense revenue at 28% and growing",
    action1: "Review Oscorp biotech investment allocation",
    action1Owner: "Demo Advisor",
    action1Due: "2026-04-15",
    action2: "Model defense revenue concentration risk",
    action2Owner: "Demo Advisor",
    action2Due: "2026-04-20",
    action3: "Engage estate attorney for Harry transfer plan",
    action3Owner: "Norman Osborn",
    action3Due: "2026-05-01",
    nextMeetingDate: "2026-06-13",
    nextMeetingAgenda: "Q2 review, estate planning update, defense pipeline",
    firmName: "Demo Firm",
    reportPeriod: "Q1 2026",
    reportDate: "2026-03-16",
    advisorName: "Demo Advisor"
  }
];

async function generateReport(client) {
  const payloadPath = `C:\\temp\\payload_${client.clientName.replace(/\s/g,'_')}.json`;
  fs.writeFileSync(payloadPath, JSON.stringify(client), 'utf8');
  
  const result = spawnSync('curl.exe', [
    '-s', '--max-time', '60',
    '-X', 'POST',
    'https://n8n.dakona.net/webhook/generate-document',
    '-H', 'Content-Type: application/json',
    '--data-binary', `@${payloadPath}`
  ], { encoding: 'utf8', timeout: 65000 });

  fs.unlinkSync(payloadPath);

  if (result.error) return { client: client.clientName, success: false, error: result.error.message };
  
  try {
    const parsed = JSON.parse(result.stdout);
    if (parsed.success) {
      return { client: client.clientName, success: true, fileName: parsed.fileName, webUrl: parsed.webUrl };
    } else {
      return { client: client.clientName, success: false, error: result.stdout };
    }
  } catch(e) {
    return { client: client.clientName, success: false, error: `Parse error: ${result.stdout}` };
  }
}

async function main() {
  console.log('Generating remaining 2 reports...\n');
  for (const client of clients) {
    process.stdout.write(`Generating report for ${client.clientName}...`);
    const result = await generateReport(client);
    if (result.success) {
      console.log(` SUCCESS: ${result.fileName}`);
      console.log(`  URL: ${result.webUrl}`);
    } else {
      console.log(` FAILED: ${result.error}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('\nDone.');
}

main().catch(console.error);
