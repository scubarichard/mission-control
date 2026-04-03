// Phase 3: Create GitHub Pages dashboard for AJ Flooring
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import https from "https";
import urlMod from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(__dirname, "kv-seed.json"), "utf-8"));
const state = JSON.parse(readFileSync(join(__dirname, "deploy-state.json"), "utf-8"));

const GH_TOKEN = seed["github-token"];
const OWNER = "scubarichard";
const REPO_NAME = "aj-flooring-dashboard";
const GH_BASE = "https://api.github.com";
const GH_HEADERS = {
  "Authorization": "token " + GH_TOKEN,
  "Accept": "application/vnd.github+json",
  "User-Agent": "n8n-rpe",
  "Content-Type": "application/json"
};

const slug = "aj-flooring";
const locationId = state.location_id;

function httpReq(method, rawUrl, headers, postBody) {
  return new Promise((resolve, reject) => {
    const parsed = urlMod.parse(rawUrl);
    const data = postBody ? JSON.stringify(postBody) : null;
    const opts = {
      hostname: parsed.hostname, path: parsed.path, method,
      headers: Object.assign({}, headers, data ? { "Content-Length": Buffer.byteLength(data) } : {})
    };
    const req = https.request(opts, (res) => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(body); } catch {}
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json, text: body });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log("=== Phase 3: Dashboard Deploy ===\n");

// 1. Create repo
console.log("Creating repo...");
const repoR = await httpReq("POST", `${GH_BASE}/user/repos`, GH_HEADERS, {
  name: REPO_NAME,
  description: "RPE Operations Dashboard for AJ Flooring Solutions",
  private: false,
  auto_init: true
});

if (repoR.ok) {
  console.log("  OK: Repo created");
} else if (repoR.status === 422) {
  console.log("  SKIP: Repo already exists");
} else {
  console.log("  FAIL:", repoR.status, repoR.json?.message);
  process.exit(1);
}

await sleep(3000);

// 2. Fetch source index.html from rpe-dashboard
console.log("Fetching template dashboard...");
const srcR = await httpReq("GET", `${GH_BASE}/repos/${OWNER}/rpe-dashboard/contents/index.html`, GH_HEADERS);
if (!srcR.ok) {
  console.log("  FAIL: Can't fetch source index.html:", srcR.status);
  process.exit(1);
}
let htmlContent = Buffer.from(srcR.json.content, "base64").toString("utf-8");
console.log("  OK: Template fetched (" + htmlContent.length + " chars)");

// 3. Build CONFIG block
const configBlock = `var CONFIG = {
  API_URL: 'https://n8n.dakona.net/webhook/${slug}-v11',
  GHL_OPP_BASE: 'https://app.gohighlevel.com/v2/location/${locationId}/opportunities/list/',
  MS_PER_DAY: 86400000,
  MARGIN_TARGET: 40,
  MARGIN_WARNING: 35,
  LABOR_CAP_PCT: 15,
  LABOR_WARNING_PCT: 12,
  STALL_DAYS_RED: 6,
  STALL_DAYS_ORANGE: 3,
  RPE_TARGET: 40000,
  RPE_WARNING: 25000,
  RPE_GAUGE_MAX: 80000,
  HEADCOUNT: 2,
  RED_FLAG_COUNT: 3,
  VELOCITY_DAYS: { today: 14, week: 28, ytd: 90 },
  CREW_NAMES: {"Crew A":"Lead 1"}
};`;

// 4. Replace CONFIG in HTML
htmlContent = htmlContent.replace(
  /var CONFIG = \{[\s\S]*?\};/,
  configBlock
);
console.log("  OK: CONFIG injected");

// 5. Commit index.html
console.log("Committing index.html...");
const commitR = await httpReq("PUT", `${GH_BASE}/repos/${OWNER}/${REPO_NAME}/contents/index.html`, GH_HEADERS, {
  message: "Deploy dashboard for AJ Flooring Solutions",
  content: Buffer.from(htmlContent).toString("base64")
});

if (commitR.ok) {
  console.log("  OK: index.html committed");
} else {
  // May need SHA if file exists
  const existR = await httpReq("GET", `${GH_BASE}/repos/${OWNER}/${REPO_NAME}/contents/index.html`, GH_HEADERS);
  if (existR.ok) {
    const sha = existR.json.sha;
    const updateR = await httpReq("PUT", `${GH_BASE}/repos/${OWNER}/${REPO_NAME}/contents/index.html`, GH_HEADERS, {
      message: "Update dashboard for AJ Flooring Solutions",
      content: Buffer.from(htmlContent).toString("base64"),
      sha
    });
    console.log("  " + (updateR.ok ? "OK: Updated" : "FAIL: " + updateR.status));
  }
}

await sleep(1000);

// 6. Fetch and deploy signoff.html
console.log("Fetching signoff form...");
const signoffR = await httpReq("GET", `${GH_BASE}/repos/${OWNER}/rpe-dashboard/contents/signoff.html`, GH_HEADERS);
if (signoffR.ok) {
  let signoffContent = Buffer.from(signoffR.json.content, "base64").toString("utf-8");
  signoffContent = signoffContent.replace(
    /var webhookUrl = "[^"]*"/,
    `var webhookUrl = "https://n8n.dakona.net/webhook/${slug}-signoff"`
  );

  const signoffCommit = await httpReq("PUT", `${GH_BASE}/repos/${OWNER}/${REPO_NAME}/contents/signoff.html`, GH_HEADERS, {
    message: "Deploy signoff form for AJ Flooring Solutions",
    content: Buffer.from(signoffContent).toString("base64")
  });
  console.log("  " + (signoffCommit.ok ? "OK: signoff.html committed" : "FAIL: " + signoffCommit.status));
} else {
  console.log("  SKIP: No signoff.html in source repo");
}

await sleep(1000);

// 7. Fetch and deploy templates/ if they exist
console.log("Checking for templates...");
const templatesR = await httpReq("GET", `${GH_BASE}/repos/${OWNER}/rpe-dashboard/contents/templates`, GH_HEADERS);
if (templatesR.ok && Array.isArray(templatesR.json)) {
  for (const file of templatesR.json) {
    if (file.type === "file") {
      const fileR = await httpReq("GET", file.url, GH_HEADERS);
      if (fileR.ok) {
        const commitF = await httpReq("PUT", `${GH_BASE}/repos/${OWNER}/${REPO_NAME}/contents/templates/${file.name}`, GH_HEADERS, {
          message: `Add template: ${file.name}`,
          content: fileR.json.content
        });
        console.log("  " + (commitF.ok ? "OK" : "FAIL") + ": templates/" + file.name);
      }
      await sleep(500);
    }
  }
} else {
  console.log("  SKIP: No templates directory");
}

await sleep(2000);

// 8. Enable GitHub Pages
console.log("Enabling GitHub Pages...");
const pagesR = await httpReq("POST", `${GH_BASE}/repos/${OWNER}/${REPO_NAME}/pages`, GH_HEADERS, {
  source: { branch: "main", path: "/" }
});
console.log("  " + (pagesR.ok ? "OK: Pages enabled" : (pagesR.status === 409 ? "SKIP: Already enabled" : "FAIL: " + pagesR.status)));

const dashboardUrl = `https://${OWNER}.github.io/${REPO_NAME}/`;
const signoffUrl = `https://${OWNER}.github.io/${REPO_NAME}/signoff.html`;

console.log("\n=== Phase 3 Complete ===");
console.log("Dashboard:", dashboardUrl);
console.log("  CEO view:", dashboardUrl + "?view=ceo");
console.log("  GM view:", dashboardUrl + "?view=gm");
console.log("  CFO view:", dashboardUrl + "?view=cfo");
console.log("Signoff:", signoffUrl);
console.log("Repo:", `https://github.com/${OWNER}/${REPO_NAME}`);

// Save state
state.phase = "3";
state.dashboard = {
  url: dashboardUrl,
  signoff_url: signoffUrl,
  repo: `${OWNER}/${REPO_NAME}`
};
writeFileSync(join(__dirname, "deploy-state.json"), JSON.stringify(state, null, 2));
console.log("State saved.");
