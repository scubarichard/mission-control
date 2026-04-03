// OPT - AI Field Mapping Agent
// Uses Claude to dynamically map commission report columns
// Handles Tyro (single-row) and Nuvei (multi-row with adjustments)
// Fix: replaced $helpers.httpRequest with fetch() — $helpers not available in Code nodes

const CLAUDE_KEY = "sk-ant-api03-Vf0qYGItvuIIny_LuUga5Ef0D343YacW07UFEe_OT-9QI6lOvj6mAXZl2LEG_sRZtl4WIAB-uidPs46M0FCMzw-zoR8JQAA";
const provider = $workflow.name.toLowerCase().includes("nuvei") ? "Nuvei" : "Tyro";
const rawRows = $input.all().map(i => i.json);
const headers = Object.keys(rawRows[0] || {});

console.log(`AI Transform: ${rawRows.length} rows, provider=${provider}, headers=${headers.length}`);

if (rawRows.length === 0) {
  return [{ json: { _skip: true, message: "No rows to process" } }];
}

const systemPrompt = `You are a data extraction agent for a payments company. Extract structured merchant data from raw commission report rows.

Provider: ${provider}

TYRO: One row per merchant. Find: MID (numeric merchant ID), merchant/trading name, report month/date, total card volume, commission/payout amount, transaction count. Also find if present: Visa volume, Mastercard volume, EFTPOS volume. Skip header rows, total rows, and blank rows.

NUVEI: Multiple rows per merchant — one main merchant row plus optional adjustment rows below it. Net adjustments against gross payout per merchant using these rules:
1. Residual Adjustment: flat -$30 deduction if merchant monthly volume < $3,000
2. Velocity Points: -0.10% of total volume (only merchants with velocity points opted in — appears as named row)
3. Same-Day Funding: -0.10% of total volume (only merchants with same-day funding opted in — appears as named row)

Group all rows by merchant, identify adjustment rows by their label/description, net them against gross payout to produce netPayout.

Return ONLY a valid JSON array, no markdown, no explanation:
[{ "mid": "", "merchantName": "", "reportMonth": "YYYY-MM-01", "txnCount": 0, "volume": 0, "grossPayout": 0, "residualAdj": 0, "velocityAdj": 0, "samedayAdj": 0, "netPayout": 0, "visaVolume": 0, "mcVolume": 0, "eftposVolume": 0 }]`;

const userMessage = `Column headers: ${JSON.stringify(headers)}\n\nRows (${rawRows.length} total):\n${JSON.stringify(rawRows.slice(0, 100))}`;

// Use fetch() instead of $helpers.httpRequest — $helpers not available in Code nodes
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": CLAUDE_KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json"
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }]
  })
});

const data = await response.json();

if (!data.content || !data.content[0]) {
  return [{ json: { _skip: true, error: "No response from Claude", raw: JSON.stringify(data).substring(0, 300) } }];
}

let merchants = [];
try {
  const text = data.content[0].text.trim();
  // Strip any markdown code fences if present
  const clean = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
  merchants = JSON.parse(clean);
} catch(e) {
  return [{ json: { _skip: true, error: "Parse failed: " + e.message, raw: data.content[0].text.substring(0, 500) } }];
}

if (!merchants.length) {
  return [{ json: { _skip: true, message: "No merchants extracted from report" } }];
}

const srcId = $("Google Drive Trigger").first().json.id;
const today = new Date().toISOString().substring(0, 10).replace(/-/g, "");
const r = n => Math.round((n || 0) * 100) / 100;

return merchants.map(m => {
  const mk = (m.reportMonth || "").substring(0, 7);
  const txnId = `${m.mid}_${mk}_${provider.toLowerCase()}`;
  const impId = `${provider.toUpperCase()}-${mk}-${today}`;
  return {
    json: {
      sourceFileId: srcId,
      airtable: {
        "MID": m.mid,
        "Provider": provider,
        "Report Month": m.reportMonth,
        "Transaction Count": m.txnCount || 0,
        "Volume": r(m.volume),
        "Commission": r(m.netPayout),
        "Visa Volume": r(m.visaVolume),
        "Mastercard Volume": r(m.mcVolume),
        "EFTPOS Volume": r(m.eftposVolume),
        "Transaction ID": txnId,
        "Import ID": impId
      },
      hubspot: {
        performance_record_id: txnId,
        provider: provider.toLowerCase(),
        month: m.reportMonth,
        transaction_count: m.txnCount || 0,
        total_card_volume: r(m.volume),
        net_residual: r(m.netPayout)
      },
      merchant: { mid: m.mid, tradingName: m.merchantName, provider }
    }
  };
});
