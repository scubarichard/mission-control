/**
 * kv-credentials.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Loads all DAX credentials from Azure Key Vault using the Container App's
 * managed identity. Falls back to environment variables for local dev / stdio.
 *
 * Usage:
 *   import { creds, startCredentialRefresh } from "./lib/kv-credentials.js";
 *
 * creds is a live object — tool functions should always read creds.X at call
 * time (not capture the value at startup) so they pick up rotations automatically.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const KV_NAME     = process.env.KV_NAME || "kvdaxdakonapilot";
const KV_BASE     = `https://${KV_NAME}.vault.azure.net`;
const REFRESH_MS  = 6 * 60 * 60 * 1000; // 6 hours

// ── Secret name map: KV secret name → creds key ──────────────────────────────
const SECRET_MAP = {
  "n8n-api-key":           "N8N_API_KEY",
  "vince-n8n-api-key":     "VINCE_N8N_API_KEY",
  "fmp-api-key":           "FMP_API_KEY",
  "finnhub-api-key":       "FINNHUB_API_KEY",
  "clickup-api-key":       "CLICKUP_API_KEY",
  "make-api-key":          "MAKE_API_KEY",
  "rpe-slack-token":       "SLACK_TOKEN",
  "desktop-bridge-secret": "DESKTOP_BRIDGE_SECRET",
  "cosmos-connection-string": "MONGO_URI",
  "ghl-api-token":         "GHL_API_TOKEN",
  "telegram-bot-token":    "TELEGRAM_BOT_TOKEN",
  "descript-api-token":    "DESCRIPT_API_TOKEN",
};

// ── Live credential store — seeded from env vars ──────────────────────────────
export const creds = {
  N8N_URL:              process.env.N8N_URL              || "https://n8n.dakona.net",
  VINCE_N8N_URL:        process.env.VINCE_N8N_URL        || "https://accessmedellin.app.n8n.cloud",
  N8N_API_KEY:          process.env.N8N_API_KEY          || "",
  VINCE_N8N_API_KEY:    process.env.VINCE_N8N_API_KEY    || "",
  FMP_API_KEY:          process.env.FMP_API_KEY          || "",
  FINNHUB_API_KEY:      process.env.FINNHUB_API_KEY      || "",
  CLICKUP_API_KEY:      process.env.CLICKUP_API_KEY      || "",
  MAKE_API_KEY:         process.env.MAKE_API_KEY         || "",
  SLACK_TOKEN:          process.env.RPE_SLACK_TOKEN      || "",
  DESKTOP_BRIDGE_SECRET:process.env.DESKTOP_BRIDGE_SECRET|| "",
  MONGO_URI:            process.env.MONGO_URI            || "",
  // GHL + Telegram — read from env, no KV rotation needed
  GHL_API_TOKEN:        process.env.GHL_API_TOKEN        || "",
  GHL_LOCATION_ID:      process.env.GHL_LOCATION_ID      || "",
  TELEGRAM_BOT_TOKEN:   process.env.TELEGRAM_BOT_TOKEN   || "",
  TELEGRAM_CHAT_ID:     process.env.TELEGRAM_CHAT_ID     || "7337480629",
  // Descript
  DESCRIPT_API_TOKEN:   process.env.DESCRIPT_API_TOKEN   || "",
  // Static — never auto-rotated (used in Claude.ai URL)
  GATEWAY_TOKEN:        process.env.MCP_GATEWAY_TOKEN    || process.env.MCP_AUTH_TOKEN || "",
  DESKTOP_BRIDGE_URL:   process.env.DESKTOP_BRIDGE_URL   || "",
};

let _kvToken    = null;
let _kvTokenExp = 0;
let _lastRefresh = null;
let _refreshTimer = null;

// ── Get managed identity token for Key Vault ─────────────────────────────────
// Container Apps use IDENTITY_ENDPOINT + IDENTITY_HEADER (not VM IMDS).
// For user-assigned identities, client_id must be specified.
const MI_CLIENT_ID = process.env.AZURE_CLIENT_ID || "";

async function getManagedIdentityToken() {
  if (_kvToken && Date.now() < _kvTokenExp - 60_000) return _kvToken;

  const identityEndpoint = process.env.IDENTITY_ENDPOINT;
  const identityHeader   = process.env.IDENTITY_HEADER;

  try {
    let res;
    if (identityEndpoint && identityHeader) {
      // Azure Container Apps managed identity endpoint
      const params = new URLSearchParams({
        resource: "https://vault.azure.net",
        "api-version": "2019-08-01",
      });
      if (MI_CLIENT_ID) params.set("client_id", MI_CLIENT_ID);
      res = await fetch(`${identityEndpoint}?${params}`, {
        headers: { "X-IDENTITY-HEADER": identityHeader },
        signal: AbortSignal.timeout(5_000),
      });
    } else {
      // Fallback: VM IMDS (local dev on Azure VM)
      res = await fetch(
        "http://169.254.169.254/metadata/identity/oauth2/token" +
        "?api-version=2018-02-01&resource=https%3A%2F%2Fvault.azure.net",
        { headers: { Metadata: "true" }, signal: AbortSignal.timeout(5_000) }
      );
    }
    if (!res.ok) throw new Error(`Token endpoint ${res.status}: ${await res.text().catch(() => "")}`);
    const data = await res.json();
    _kvToken    = data.access_token;
    _kvTokenExp = Date.now() + parseInt(data.expires_in, 10) * 1000;
    return _kvToken;
  } catch (err) {
    throw new Error(`Managed identity token fetch failed: ${err.message}`);
  }
}

// ── Fetch a single secret from Key Vault ─────────────────────────────────────
async function fetchSecret(secretName, token) {
  const res = await fetch(
    `${KV_BASE}/secrets/${secretName}?api-version=7.4`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`KV ${secretName}: ${res.status} ${body}`);
  }
  const data = await res.json();
  return data.value || "";
}

// ── Load all secrets from Key Vault into creds ────────────────────────────────
export async function loadFromKeyVault() {
  let token;
  try {
    token = await getManagedIdentityToken();
  } catch (err) {
    console.warn(`[KV] Managed identity unavailable — using env vars: ${err.message}`);
    return false;
  }

  const results = { loaded: [], failed: [] };

  for (const [secretName, credsKey] of Object.entries(SECRET_MAP)) {
    try {
      const value = await fetchSecret(secretName, token);
      if (value) {
        creds[credsKey] = value;
        results.loaded.push(secretName);
      }
    } catch (err) {
      results.failed.push(`${secretName}: ${err.message}`);
    }
  }

  _lastRefresh = new Date().toISOString();

  if (results.failed.length > 0) {
    console.warn(`[KV] Partial load — failed: ${results.failed.join(", ")}`);
  }
  console.log(`[KV] Credentials refreshed at ${_lastRefresh} — loaded: ${results.loaded.length}/${Object.keys(SECRET_MAP).length}`);
  return true;
}

// ── Start background refresh every 6 hours ───────────────────────────────────
export function startCredentialRefresh() {
  if (_refreshTimer) return; // already running
  _refreshTimer = setInterval(async () => {
    console.log("[KV] Scheduled credential refresh starting...");
    await loadFromKeyVault().catch(err => console.error("[KV] Refresh error:", err.message));
  }, REFRESH_MS);
  _refreshTimer.unref(); // don't block process exit
  console.log(`[KV] Background credential refresh scheduled every ${REFRESH_MS / 3_600_000}h`);
}

// ── Status — exposed via /health endpoint ─────────────────────────────────────
export function getCredentialStatus() {
  return {
    lastRefresh: _lastRefresh,
    nextRefresh: _lastRefresh
      ? new Date(new Date(_lastRefresh).getTime() + REFRESH_MS).toISOString()
      : null,
    source: _lastRefresh ? "key-vault" : "env-vars",
    kvName: KV_NAME,
  };
}
