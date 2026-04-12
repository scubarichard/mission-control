#!/usr/bin/env python3
"""
Gate 4 — Expense + Guide_Payroll E2E test
Written by Dax/Sonnet for Atlas to execute
Results written to RESULTS/gate4_results.md
"""

import urllib.request
import json
import time
from datetime import datetime

# Token — Atlas to read from environment or hardcode from the PNT .env
# The token is the AIRTABLE_API_TOKEN in P:/_clients/pnt-central-brain/.env on the Windows desktop
# Atlas: get this token via desktop_run_powershell:
#   $raw = Get-Content "P:\_clients\pnt-central-brain\.env" -Raw -Encoding UTF8
#   $token = ($raw -split "`n" | Where-Object { $_ -match "AIRTABLE" } | Select-Object -First 1) -replace ".*=", "" -replace "\s", ""
#   Write-Host $token

BASE = "https://api.airtable.com/v0/appDqWxcM86CpBHoQ"
META = "https://api.airtable.com/v0/meta/bases/appDqWxcM86CpBHoQ"

# Atlas: replace this with actual token retrieved from desktop
TOKEN = "REPLACE_WITH_TOKEN_FROM_DESKTOP"

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

results = []
overall = True

def api(method, url, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise Exception(f"{e.code}: {e.read().decode()}")

def check(label, condition, got=""):
    status = "PASS" if condition else f"FAIL{' got=' + str(got) if got else ''}"
    results.append(f"- {label}: {status}")
    if not condition:
        global overall
        overall = False
    return condition

try:
    # Get seeded booking
    r = api("GET", f"{BASE}/Bookings?maxRecords=1")
    booking_id = r["records"][0]["id"]
    results.append(f"- Booking ID: {booking_id}")

    # Get guide
    r = api("GET", f"{BASE}/Guides_Staff?maxRecords=1")
    guide_id = r["records"][0]["id"]
    results.append(f"- Guide ID: {guide_id}")

    # Create Guide_Payroll
    payroll = api("POST", f"{BASE}/Guide_Payroll", {"fields": {
        "Booking": [booking_id],
        "Guide": [guide_id],
        "Days Worked": 5,
        "Daily Rate": 180,
        "Status": "Pending"
    }})
    payroll_id = payroll["id"]
    check("Payroll created", bool(payroll_id))
    time.sleep(0.3)

    # Expense A — Guide, reimbursable
    exp_a = api("POST", f"{BASE}/Expenses", {"fields": {
        "Booking": [booking_id],
        "Guide Payroll": [payroll_id],
        "Category": "Guide",
        "Amount": 45,
        "Paid By": "Guide",
        "Status": "Pending"
    }})
    exp_a_id = exp_a["id"]
    check("Expense A created", bool(exp_a_id))

    # Expense B — Taxi, PNT pays
    exp_b = api("POST", f"{BASE}/Expenses", {"fields": {
        "Booking": [booking_id],
        "Category": "Taxi",
        "Amount": 120,
        "Paid By": "PNT",
        "Status": "Pending"
    }})
    exp_b_id = exp_b["id"]
    check("Expense B created", bool(exp_b_id))
    time.sleep(0.3)

    # Verify
    vp = api("GET", f"{BASE}/Guide_Payroll/{payroll_id}")
    va = api("GET", f"{BASE}/Expenses/{exp_a_id}")
    vb = api("GET", f"{BASE}/Expenses/{exp_b_id}")

    check("Payroll Booking link", bool(vp["fields"].get("Booking")))
    check("Payroll Guide link", bool(vp["fields"].get("Guide")))
    check("Expense A Category=Guide", va["fields"].get("Category") == "Guide", va["fields"].get("Category"))
    check("Expense A Paid By=Guide", va["fields"].get("Paid By") == "Guide", va["fields"].get("Paid By"))
    check("Expense A Payroll link", bool(va["fields"].get("Guide Payroll")))
    check("Expense B Category=Taxi", vb["fields"].get("Category") == "Taxi", vb["fields"].get("Category"))
    check("Expense B Paid By=PNT", vb["fields"].get("Paid By") == "PNT", vb["fields"].get("Paid By"))

    # CN total = expense A amount, PNT total = expense B amount
    check("Expense A amount=45", va["fields"].get("Amount") == 45, va["fields"].get("Amount"))
    check("Expense B amount=120", vb["fields"].get("Amount") == 120, vb["fields"].get("Amount"))

    # Cleanup
    api("DELETE", f"{BASE}/Expenses?records[]={exp_a_id}&records[]={exp_b_id}")
    api("DELETE", f"{BASE}/Guide_Payroll?records[]={payroll_id}")
    results.append("- Cleanup: PASS")

except Exception as e:
    results.append(f"- ERROR: {e}")
    overall = False

# Write results
output = f"""# Gate 4 Results
Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Overall: {'PASS' if overall else 'FAIL'}

{chr(10).join(results)}
"""

import os
os.makedirs("RESULTS", exist_ok=True)
with open("RESULTS/gate4_results.md", "w") as f:
    f.write(output)

print(output)
