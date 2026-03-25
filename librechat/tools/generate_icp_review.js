/**
 * DAX Document Generator — ICP Quarterly Review Tool
 *
 * Called by GPT-4o via LibreChat function calling.
 * POSTs all 35 fields to the n8n webhook and returns the SharePoint URL.
 *
 * Usage as a LibreChat Langchain tool:
 *   const GenerateICPReview = require('./generate_icp_review');
 *   const tool = new GenerateICPReview();
 *
 * Usage standalone (testing):
 *   node generate_icp_review.js '{"clientName":"John Smith","portfolioValue":"$2.45M","ytdReturn":"4.2%","reportPeriod":"Q1 2026"}'
 */

const { Tool } = require('@langchain/core/tools');
const https = require('https');
const http = require('http');

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'https://n8n.dakona.net/webhook/generate-document';

// Hard-coded defaults for Demo Firm / Demo Advisor
const DEFAULTS = {
  firmName: 'Demo Firm',
  advisorName: 'Demo Advisor',
  meetingLocation: 'Zoom',
  reportDate: new Date().toISOString().slice(0, 10),
  reportPeriod: 'Q1 2026',
};

function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);

    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString();
          try {
            resolve(JSON.parse(raw));
          } catch {
            resolve({ raw });
          }
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

class GenerateICPReview extends Tool {
  name = 'generate_icp_review';

  description =
    'Generates a quarterly ICP client review document and saves it to SharePoint. ' +
    'Required: clientName, reportPeriod, portfolioValue, ytdReturn. ' +
    'Returns the SharePoint URL of the completed document. ' +
    'Input must be a JSON string with the field values.';

  /** @param {string} input — JSON string of field values */
  async _call(input) {
    let fields;
    try {
      fields = typeof input === 'string' ? JSON.parse(input) : input;
    } catch {
      return JSON.stringify({
        error: 'Invalid input — expected a JSON string with field values.',
      });
    }

    // Merge defaults (only fill in fields not provided by the model)
    const payload = { ...DEFAULTS, ...fields };

    // Ensure reportDate defaults to today if not set
    if (!payload.reportDate) {
      payload.reportDate = new Date().toISOString().slice(0, 10);
    }

    try {
      const result = await postJSON(N8N_WEBHOOK_URL, payload);

      if (result.success && result.webUrl) {
        return JSON.stringify({
          success: true,
          message: `Document generated successfully for ${payload.clientName}.`,
          url: result.webUrl,
          fileName: result.fileName,
        });
      }

      return JSON.stringify({
        success: false,
        error: 'Document generation did not return a URL.',
        details: result,
      });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: `Failed to call document generator: ${err.message}`,
      });
    }
  }
}

module.exports = GenerateICPReview;

// --- Standalone execution for testing ---
if (require.main === module) {
  const input = process.argv[2] || '{}';
  const tool = new GenerateICPReview();
  tool._call(input).then((result) => {
    console.log(result);
    process.exit(0);
  });
}
