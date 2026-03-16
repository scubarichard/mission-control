/**
 * Update the promptPrefix inline string in modelSpecs section of librechat.yaml
 */
const fs = require('fs');
const path = require('path');

const file = path.join('P:', '_clients', 'dakona', 'dax', 'librechat', 'librechat.yaml');
let content = fs.readFileSync(file, 'utf8');

// The promptPrefix has escaped newlines as \n in the inline YAML string
const oldSnippet = `When an advisor asks you to generate a client review, quarterly report, or ICP report:\\n1. Ask for the client name if not provided\\n2. Ask for portfolio value and YTD return if not provided (these are the only two fields you typically need to ask about)\\n3. Call generateICPReview passing EVERY field you extracted. CRITICAL - you MUST include ALL fields: clientName, firmName, reportPeriod, reportDate, advisorName, accountNumber, accountType, riskProfile, meetingDate, meetingLocation, attendees, meetingDuration, discussionPoint1, discussionPoint2, discussionPoint3, advisorNotes, portfolioValue, ytdReturn, benchmarkReturn, vsBenchmark, goal1, goal2, goal3, goalsProgressNotes, action1, action1Owner, action1Due, action2, action2Owner, action2Due, action3, action3Owner, action3Due, nextMeetingDate, nextMeetingAgenda\\n4. Present the SharePoint link to the advisor when the document is ready\\n\\nDefault values (do not ask for these unless the advisor wants to change them):\\n- firmName: Impact Capital Partners\\n- advisorName: Brett Stone\\n- meetingLocation: Zoom\\n- reportDate: today's date\\n- reportPeriod: Q1 2026\\n\\nFor any fields the advisor does not provide, use reasonable defaults or leave them empty. Do not ask more than 2 clarifying questions`;

const newSnippet = `When an advisor asks you to generate a client review, quarterly report, or ICP report:\\n1. Ask for the client name if not provided\\n2. Ask for portfolio value and YTD return if not provided (these are the only two fields you need)\\n3. IMMEDIATELY call generateICPReview. Do NOT write any text before calling the tool. Your response MUST be the tool call itself. Never say "I will generate", "Please hold on", or "Let me generate" — just call the tool directly with no preamble.\\n4. After the tool returns, present the SharePoint link to the advisor\\n\\nCRITICAL TOOL CALLING RULE: When you have clientName and portfolioValue, your FIRST and ONLY response must be the actual generateICPReview tool call — no text whatsoever before it.\\n\\nRequired fields: clientName, firmName, reportPeriod, reportDate, advisorName, accountNumber, accountType, riskProfile, meetingDate, meetingLocation, attendees, meetingDuration, discussionPoint1, discussionPoint2, discussionPoint3, advisorNotes, portfolioValue, ytdReturn, benchmarkReturn, vsBenchmark, goal1, goal2, goal3, goalsProgressNotes, action1, action1Owner, action1Due, action2, action2Owner, action2Due, action3, action3Owner, action3Due, nextMeetingDate, nextMeetingAgenda\\n\\nDefault values (use without asking):\\n- firmName: Impact Capital Partners\\n- advisorName: Brett Stone\\n- meetingLocation: Zoom\\n- reportDate: today's date\\n- reportPeriod: Q1 2026\\n\\nFor any fields the advisor does not provide, use reasonable defaults. Do not ask more than 2 clarifying questions`;

const occurrences = content.split(oldSnippet).length - 1;
console.log('Found', occurrences, 'promptPrefix occurrence(s)');

if (occurrences > 0) {
    const newContent = content.split(oldSnippet).join(newSnippet);
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Updated promptPrefix');
    const v = fs.readFileSync(file, 'utf8');
    console.log('Verify CRITICAL count in file:', v.split('CRITICAL TOOL CALLING RULE').length - 1);
} else {
    // Show what's in the promptPrefix around this area
    const idx = content.indexOf('When an advisor asks you to generate a client review, quarterly report');
    console.log('Occurrences found at indices:');
    let start = 0;
    while (true) {
        const i = content.indexOf('When an advisor asks you to generate a client review', start);
        if (i === -1) break;
        console.log(' index', i, '- context:', JSON.stringify(content.substring(i, i + 100)));
        start = i + 1;
    }
}
