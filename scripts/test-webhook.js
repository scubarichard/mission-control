/**
 * Test the n8n generate-document webhook with full 35-field payload
 */
const https = require('https');

const payload = {
  firmName: 'Demo Firm',
  clientName: 'John Smith',
  reportPeriod: 'Q1 2026',
  reportDate: '2026-03-16',
  advisorName: 'Demo Advisor',
  accountNumber: 'ICP-7842-A',
  accountType: 'Taxable Brokerage',
  riskProfile: 'Moderate Growth',
  meetingDate: '2026-03-10',
  meetingLocation: 'Zoom',
  attendees: 'Demo Advisor',
  meetingDuration: '60',
  discussionPoint1: 'Retirement timeline',
  discussionPoint2: 'Tax loss harvesting',
  discussionPoint3: 'Portfolio allocation',
  advisorNotes: 'Client comfortable with allocation',
  portfolioValue: '2,450,000',
  ytdReturn: '4.2%',
  benchmarkReturn: '3.8%',
  vsBenchmark: '+0.4%',
  goal1: 'Retire by 62',
  goal2: 'Fund college for two kids',
  goal3: '$180K/year income',
  goalsProgressNotes: 'On track',
  action1: 'Update beneficiaries',
  action1Owner: 'John Smith',
  action1Due: '2026-03-30',
  action2: 'Review tax loss harvesting',
  action2Owner: 'Demo Advisor',
  action2Due: '2026-04-15',
  action3: '',
  action3Owner: '',
  action3Due: '',
  nextMeetingDate: '2026-06-15',
  nextMeetingAgenda: 'Mid-year review'
};

const body = JSON.stringify(payload);
console.log('Sending', Object.keys(payload).length, 'fields to n8n...');
console.log('Payload size:', body.length, 'bytes');

const options = {
  hostname: 'n8n.dakona.net',
  port: 443,
  path: '/webhook/generate-document',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  },
  timeout: 60000
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('\nSTATUS:', res.statusCode);
    console.log('RESPONSE:', data.substring(0, 1000));
    if (res.statusCode === 200) {
      try {
        const parsed = JSON.parse(data);
        console.log('\n✅ SUCCESS!');
        console.log('SharePoint URL:', parsed.webUrl || parsed.url || 'not in response');
      } catch(e) {
        console.log('Response is not JSON');
      }
    }
  });
});

req.on('error', e => console.log('ERROR:', e.message));
req.on('timeout', () => { console.log('TIMEOUT after 60s'); req.destroy(); });
req.write(body);
req.end();
