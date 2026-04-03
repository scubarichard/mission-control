"""Rename RPE n8n workflows to uniform [RPE] vXX - Name format."""
import json, time, urllib.request, ssl, os

API_KEY = os.environ.get("N8N_API_KEY", "")
if not API_KEY:
    # fallback to kv-seed
    seed_path = os.path.join(os.path.dirname(__file__), "kv-seed.json")
    with open(seed_path) as f:
        API_KEY = json.load(f).get("n8n-api-key", "")

BASE = "https://n8n.dakona.net/api/v1/workflows"
STRIP = ["id","createdAt","updatedAt","versionId","activeVersionId",
         "versionCounter","triggerCount","shared","tags","homeProject",
         "sharedWithProjects","activeVersion","isArchived"]

RENAMES = {
    "c0SH3hq7pOSJOUT8": "[RPE] v01 - Margin Guardrail",
    "4SdANPI4fHdQHfHt": "[RPE] v02 - Labor Cap Monitor",
    "XLSzvHPH1EXE5Hmi": "[RPE] v03 - Field Validation Gate",
    "htdexofw5jLuXdVC": "[RPE] v04 - Job Completion",
    "DglLCFDXMImJm4ab": "[RPE] v05 - Material Order",
    "c2HXjNKTNzXJ03Gb": "[RPE] v06 - Change Order Sync",
    "mNx2Bzsyv6mHJcPV": "[RPE] v07 - Payout Gate",
    "SWMRfS0TOop4Y2xi": "[RPE] v09 - Dashboard Feed",
    "7f6zGmBndNabEibH": "[RPE] v10 - Dashboard Feed GHL",
    "5w24uaikuQ7xwZpx": "[RPE] v11 - Dashboard Live JSON",
    "mcahdYCVbZ7778wl": "[RPE] v12 - Dashboard Webhook",
    "j6znmoVMC7a6QKFM": "[RPE] v20 - Client Onboarding Orchestrator",
}

ctx = ssl.create_default_context()

def api(method, wid, body=None):
    url = f"{BASE}/{wid}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("X-N8N-API-KEY", API_KEY)
    if body:
        req.add_header("Content-Type", "application/json; charset=utf-8")
    with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
        return json.loads(resp.read())

results = []
for wid, new_name in RENAMES.items():
    try:
        wf = api("GET", wid)
        wf["name"] = new_name
        for k in STRIP:
            wf.pop(k, None)
        r = api("PUT", wid, wf)
        results.append(f"OK: {r['name']}")
    except Exception as e:
        results.append(f"FAIL: {new_name} - {e}")
    time.sleep(1)

print("\n".join(results))
