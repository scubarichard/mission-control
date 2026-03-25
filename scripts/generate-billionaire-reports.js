/**
 * Generate 5 comic book billionaire ICP reports directly via n8n webhook
 * Bypasses DAX agent — calls the working webhook directly
 */
const { execSync } = require('child_process');

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
    nextMeetingAgenda: "Q2 review, alternative investment proposal, endowment planning"
  },
  {
    clientName: "Bruce Wayne",
    accountNumber: "ICP-0001-BW",
    accountType: "Trust Account",
    riskProfile: "Moderate Growth",
    meetingDate: "2026-03-11",
    meetingLocation: "Zoom",
    attendees: "Demo Advisor, Bruce Wayne, Alfred Pennyworth",
    meetingDuration: "60",
    portfolioValue: "9800000000",
    ytdReturn: "5.2%",
    benchmarkReturn: "5.8%",
    vsBenchmark: "-0.6%",
    discussionPoint1: "Wayne Enterprises board succession planning",
    discussionPoint2: "Wayne Foundation charitable giving strategy",
    discussionPoint3: "Real estate portfolio — Wayne Manor restoration costs",
    advisorNotes: "Client travels frequently and prefers quarterly meetings",
    goal1: "Maintain Wayne Enterprises majority ownership",
    goal2: "Fund Wayne Foundation at $100M annually",
    goal3: "Build $500M liquid reserve for strategic acquisitions",
    goalsProgressNotes: "Foundation giving on track; liquid reserve building slower than planned",
    action1: "Review Wayne Enterprises equity hedge strategy",
    action1Owner: "Demo Advisor",
    action1Due: "2026-04-10",
    action2: "Optimize foundation giving tax efficiency",
    action2Owner: "Demo Advisor",
    action2Due: "2026-04-20",
    action3: "Evaluate Wayne Manor real estate carrying costs",
    action3Owner: "Alfred Pennyworth",
    action3Due: "2026-04-30",
    nextMeetingDate: "2026-06-10",
    nextMeetingAgenda: "Q2 review, succession planning update, foundation strategy"
  },
  {
    clientName: "Lex Luthor",
    accountNumber: "ICP-9999-LL",
    accountType: "Corporate Account",
    riskProfile: "Aggressive Growth",
    meetingDate: "2026-03-12",
    meetingLocation: "Zoom",
    attendees: "Demo Advisor, Lex Luthor",
    meetingDuration: "45",
    portfolioValue: "75000000000",
    ytdReturn: "11.3%",
    benchmarkReturn: "7.2%",
    vsBenchmark: "+4.1%",
    discussionPoint1: "LexCorp global expansion capital requirements",
    discussionPoint2: "Political campaign contribution compliance",
    discussionPoint3: "Kryptonite mineral rights acquisition",
    advisorNotes: "Client highly engaged and detail-oriented; requests monthly performance reports",
    goal1: "Grow LexCorp to $100B revenue within 5 years",
    goal2: "Establish $1B political influence fund",
    goal3: "Acquire controlling interest in Daily Planet media group",
    goalsProgressNotes: "Revenue growth ahead of schedule; media acquisition in negotiation",
    action1: "Model LexCorp expansion capital structure",
    action1Owner: "Demo Advisor",
    action1Due: "2026-04-01",
    action2: "Review PAC contribution compliance with counsel",
    action2Owner: "Lex Luthor",
    action2Due: "2026-04-05",
    action3: "Prepare Daily Planet acquisition term sheet analysis",
    action3Owner: "Demo Advisor",
    action3Due: "2026-04-15",
    nextMeetingDate: "2026-05-12",
    nextMeetingAgenda: "Q2 early review, LexCorp expansion update, media acquisition"
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
    nextMeetingAgenda: "Q2 review, estate planning update, defense pipeline"
  },
  {
    clientName: "Wilson Fisk",
    accountNumber: "ICP-0505-WF",
    accountType: "Real Estate Investment Trust",
    riskProfile: "Conservative Growth",
    meetingDate: "2026-03-14",
    meetingLocation: "Zoom",
    attendees: "Demo Advisor, Wilson Fisk",
    meetingDuration: "60",
    portfolioValue: "12500000000",
    ytdReturn: "4.8%",
    benchmarkReturn: "5.0%",
    vsBenchmark: "-0.2%",
    discussionPoint1: "New York City commercial real estate consolidation",
    discussionPoint2: "Fisk Tower development financing",
    discussionPoint3: "Mayoral campaign financial disclosures and compliance",
    advisorNotes: "Client methodical and deliberate; prefers conservative projections",
    goal1: "Control 30% of Manhattan commercial real estate",
    goal2: "Complete Fisk Tower at $800M development cost",
    goal3: "Maintain clean financial disclosures for political viability",
    goalsProgressNotes: "At 22% Manhattan commercial share; Fisk Tower 60% complete",
    action1: "Identify next Manhattan acquisition targets",
    action1Owner: "Demo Advisor",
    action1Due: "2026-04-10",
    action2: "Review Fisk Tower construction financing draw schedule",
    action2Owner: "Demo Advisor",
    action2Due: "2026-04-15",
    action3: "Prepare campaign financial disclosure summary",
    action3Owner: "Wilson Fisk",
    action3Due: "2026-04-20",
    nextMeetingDate: "2026-06-14",
    nextMeetingAgenda: "Q2 review, Fisk Tower update, acquisition pipeline"
  }
];

async function generateReport(client) {
  const payload = {
    ...client,
    firmName: "Demo Firm",
    reportPeriod: "Q1 2026",
    reportDate: "2026-03-16",
    advisorName: "Demo Advisor"
  };

  const json = JSON.stringify(payload);
  
  try {
    const result = execSync(
      `curl.exe -s --max-time 60 -X POST https://n8n.dakona.net/webhook/generate-document -H "Content-Type: application/json" -d "${json.replace(/"/g, '\\"')}"`,
      { encoding: 'utf8', timeout: 65000 }
    );
    const parsed = JSON.parse(result);
    return { client: client.clientName, success: true, fileName: parsed.fileName, webUrl: parsed.webUrl };
  } catch (e) {
    return { client: client.clientName, success: false, error: e.message };
  }
}

async function main() {
  console.log('Generating 5 comic book billionaire ICP reports...\n');
  
  for (const client of clients) {
    process.stdout.write(`Generating report for ${client.clientName}...`);
    const result = await generateReport(client);
    if (result.success) {
      console.log(` ✓ ${result.fileName}`);
      console.log(`  URL: ${result.webUrl}`);
    } else {
      console.log(` ✗ FAILED: ${result.error}`);
    }
    // Small delay between calls
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('\nDone.');
}

main().catch(console.error);
