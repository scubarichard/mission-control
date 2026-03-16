const fs = require('fs');
const yaml = require('js-yaml');

const filePath = 'P:/_clients/dakona/dax/librechat/librechat.yaml';
let content = fs.readFileSync(filePath, 'utf8');

// Replace all mentions of "generateICPReview" in the system prompt with generic language
// so GPT-4o calls the actual registered tool name instead of writing text

const fixes = [
    // Fix the main document generation instructions
    [
        'IMMEDIATELY call generateICPReview. Do NOT write any text before calling the tool. Your response MUST be the tool call itself. Never say I will generate, Please hold on, or Let me generate -- just call the tool directly with no preamble.\n      4. After the tool returns, present the SharePoint link to the advisor\n\n      CRITICAL TOOL CALLING RULE: When you have clientName and portfolioValue, your FIRST and ONLY response must be the actual generateICPReview tool call -- no text whatsoever before it. Call the tool immediately and silently.\n\n      Required fields to include in the call:\n      clientName, firmName, reportPeriod, reportDate, advisorName, accountNumber, accountType, riskProfile, meetingDate, meetingLocation, attendees, meetingDuration, discussionPoint1, discussionPoint2, discussionPoint3, advisorNotes, portfolioValue, ytdReturn, benchmarkReturn, vsBenchmark, goal1, goal2, goal3, goalsProgressNotes, action1, action1Owner, action1Due, action2, action2Owner, action2Due, action3, action3Owner, action3Due, nextMeetingDate, nextMeetingAgenda',
        'IMMEDIATELY invoke the ICP document generation tool. Do NOT write any text before invoking the tool -- the tool call IS your entire response. Never say "I will generate", "Please hold on", or "Let me generate". Just invoke the tool with no preamble whatsoever.\n      4. After the tool returns a SharePoint link, present that link to the advisor\n\n      CRITICAL: When you have clientName and portfolioValue, make the tool call as your FIRST action with zero text before it.\n\n      Required fields to pass to the tool:\n      clientName, firmName, reportPeriod, reportDate, advisorName, accountNumber, accountType, riskProfile, meetingDate, meetingLocation, attendees, meetingDuration, discussionPoint1, discussionPoint2, discussionPoint3, advisorNotes, portfolioValue, ytdReturn, benchmarkReturn, vsBenchmark, goal1, goal2, goal3, goalsProgressNotes, action1, action1Owner, action1Due, action2, action2Owner, action2Due, action3, action3Owner, action3Due, nextMeetingDate, nextMeetingAgenda'
    ],
    // Fix the document upload confirmation step
    [
        '5. On confirmation, call generateICPReview with all 35 fields',
        '5. On confirmation, invoke the ICP document generation tool with all 35 fields'
    ],
    // Fix the saveClientDocument reference
    [
        'always save the source document to SharePoint by calling saveClientDocument with:',
        'always save the source document to SharePoint using the saveClientDocument tool with:'
    ],
    // Fix the intro sentence
    [
        'You can generate quarterly ICP client review documents and save them to SharePoint by calling the generateICPReview action.',
        'You can generate quarterly ICP client review documents and save them to SharePoint using the available document generation tools.'
    ]
];

let changeCount = 0;
for (const [old, newStr] of fixes) {
    const count = content.split(old).length - 1;
    if (count > 0) {
        content = content.split(old).join(newStr);
        changeCount += count;
        console.log(`Replaced ${count}x: "${old.substring(0, 60)}..."`);
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nTotal replacements: ${changeCount}`);

// Verify YAML parses
try {
    const parsed = yaml.load(content);
    const sp = parsed.endpoints.azureOpenAI.systemPrompt;
    console.log('YAML valid - systemPrompt length:', sp.length);
    console.log('Contains generateICPReview:', sp.includes('generateICPReview'));
    console.log('Contains "invoke the ICP":', sp.includes('invoke the ICP'));
} catch(e) {
    console.log('YAML error:', e.message.substring(0, 200));
}
