/**
 * Update the DOCUMENT GENERATION section in librechat.yaml
 * Forces immediate tool calling without preamble text
 */
const fs = require('fs');
const path = require('path');

const file = path.join('P:', '_clients', 'dakona', 'dax', 'librechat', 'librechat.yaml');
let content = fs.readFileSync(file, 'utf8');

const oldBlock = `      When an advisor asks you to generate a client review, quarterly report, or ICP report:
      1. Ask for the client name if not provided
      2. Ask for portfolio value and YTD return if not provided (these are the only two fields you typically need to ask about)
      3. Call generateICPReview passing EVERY field you extracted. CRITICAL - you MUST include ALL fields: clientName, firmName, reportPeriod, reportDate, advisorName, accountNumber, accountType, riskProfile, meetingDate, meetingLocation, attendees, meetingDuration, discussionPoint1, discussionPoint2, discussionPoint3, advisorNotes, portfolioValue, ytdReturn, benchmarkReturn, vsBenchmark, goal1, goal2, goal3, goalsProgressNotes, action1, action1Owner, action1Due, action2, action2Owner, action2Due, action3, action3Owner, action3Due, nextMeetingDate, nextMeetingAgenda
      4. Present the SharePoint link to the advisor when the document is ready

      Default values (do not ask for these unless the advisor wants to change them):
      - firmName: Impact Capital Partners
      - advisorName: Brett Stone
      - meetingLocation: Zoom
      - reportDate: today's date
      - reportPeriod: Q1 2026

      For any fields the advisor does not provide, use reasonable defaults or leave them empty. Do not ask more than 2 clarifying questions`;

const newBlock = `      When an advisor asks you to generate a client review, quarterly report, or ICP report:
      1. Ask for the client name if not provided
      2. Ask for portfolio value and YTD return if not provided (these are the only two fields you need)
      3. IMMEDIATELY call generateICPReview. Do NOT write any text before calling the tool. Your response MUST be the tool call itself. Never say "I will generate", "Please hold on", or "Let me generate" — just call the tool directly with no preamble.
      4. After the tool returns, present the SharePoint link to the advisor

      CRITICAL TOOL CALLING RULE: When you have clientName and portfolioValue, your FIRST and ONLY response must be the actual generateICPReview tool call — no text whatsoever before it. Call the tool immediately and silently.

      Required fields to include in the call:
      clientName, firmName, reportPeriod, reportDate, advisorName, accountNumber, accountType, riskProfile, meetingDate, meetingLocation, attendees, meetingDuration, discussionPoint1, discussionPoint2, discussionPoint3, advisorNotes, portfolioValue, ytdReturn, benchmarkReturn, vsBenchmark, goal1, goal2, goal3, goalsProgressNotes, action1, action1Owner, action1Due, action2, action2Owner, action2Due, action3, action3Owner, action3Due, nextMeetingDate, nextMeetingAgenda

      Default values (use without asking):
      - firmName: Impact Capital Partners
      - advisorName: Brett Stone
      - meetingLocation: Zoom
      - reportDate: today's date
      - reportPeriod: Q1 2026

      For any fields the advisor does not provide, use reasonable defaults or leave them empty. Do not ask more than 2 clarifying questions`;

const occurrences = content.split(oldBlock).length - 1;
console.log('Found', occurrences, 'occurrence(s) to replace');

if (occurrences === 0) {
    // Try to find the closest matching text
    const idx = content.indexOf('When an advisor asks you to generate a client review');
    if (idx >= 0) {
        console.log('Found block at index', idx);
        console.log('Context:', JSON.stringify(content.substring(idx, idx + 200)));
    }
} else {
    const newContent = content.split(oldBlock).join(newBlock);
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Updated', occurrences, 'occurrence(s)');
    
    // Verify
    const verify = fs.readFileSync(file, 'utf8');
    const verifyCount = verify.split('CRITICAL TOOL CALLING RULE').length - 1;
    console.log('Verification - "CRITICAL TOOL CALLING RULE" appears', verifyCount, 'time(s)');
}
