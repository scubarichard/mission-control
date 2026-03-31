import requests, json, sys, io, time, csv
from io import StringIO
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

TOKEN = "patkX3PmrObHeTNmn.78ae1da8f8cfd536c7d0f1403777be3e0be1110945dd82fa421b1932483ce9fa"
BASE_ID = "app6lhrz0MSMj95Dp"
SHEET_ID = "1E1wgzj2NqfO0bUUV8D1GQQNnlArK6VuuRwHRoiQ5JEQ"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
AUTH = {"Authorization": f"Bearer {TOKEN}"}

def safe_int(val):
    try: return int(float(val))
    except: return None

def fetch_all(table_id):
    records = []
    offset = None
    while True:
        params = {"pageSize": 100}
        if offset: params["offset"] = offset
        r = requests.get(f"https://api.airtable.com/v0/{BASE_ID}/{table_id}", headers=AUTH, params=params, timeout=60)
        data = r.json()
        records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset: break
        time.sleep(0.2)
    return records

def batch_create(table_id, records):
    created = 0
    for i in range(0, len(records), 10):
        batch = records[i:i+10]
        for attempt in range(3):
            try:
                resp = requests.post(f"https://api.airtable.com/v0/{BASE_ID}/{table_id}",
                                    headers=HEADERS, json={"records": batch, "typecast": True}, timeout=60)
                if resp.status_code == 200:
                    created += len(resp.json().get("records", []))
                    break
                elif resp.status_code == 429:
                    time.sleep(5)
                else:
                    print(f"    Error: {resp.text[:200]}")
                    break
            except:
                time.sleep(5)
        time.sleep(0.3)
    return created

def batch_patch(table_id, updates):
    patched = 0
    for i in range(0, len(updates), 10):
        batch = updates[i:i+10]
        for attempt in range(3):
            try:
                resp = requests.patch(f"https://api.airtable.com/v0/{BASE_ID}/{table_id}",
                                     headers=HEADERS, json={"records": batch}, timeout=60)
                if resp.status_code == 200:
                    patched += len(resp.json().get("records", []))
                    break
                elif resp.status_code == 429:
                    time.sleep(5)
                else:
                    break
            except:
                time.sleep(5)
        time.sleep(0.5)
        if (i+10) % 500 == 0:
            print(f"    ...{patched} patched", flush=True)
    return patched

# STEP 1: Get existing companies
print("=" * 60)
print("STEP 1: IDENTIFY GAPS")
print("=" * 60)

existing = fetch_all("tblqDN4s1r00mK1Us")
existing_cw_ids = set()
existing_names_lower = {}
for r in existing:
    cid = r["fields"].get("CW Company ID")
    if cid: existing_cw_ids.add(int(cid))
    name = r["fields"].get("Company Name", "").strip()
    if name: existing_names_lower[name.lower()] = r["id"]

print(f"Existing: {len(existing)} companies, {len(existing_cw_ids)} with CW ID")

# Read source sheet
url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid=1647068601"
r = requests.get(url, timeout=60)
reader = csv.DictReader(StringIO(r.text))
sheet_companies = list(reader)
print(f"Source sheet: {len(sheet_companies)} companies")

# Build name-to-sheet map
name_to_sheet = {}
for row in sheet_companies:
    name = row.get("Name", "").strip().lower()
    if name: name_to_sheet[name] = row

# STEP 2: Fix existing companies missing CW IDs
print("\n" + "=" * 60)
print("STEP 2: FIX EXISTING COMPANIES MISSING CW IDs")
print("=" * 60)

fixes = []
for r in existing:
    if not r["fields"].get("CW Company ID"):
        name = r["fields"].get("Company Name", "").strip().lower()
        if name in name_to_sheet:
            cid = safe_int(name_to_sheet[name].get("CompanyID"))
            if cid:
                fixes.append({"id": r["id"], "fields": {"CW Company ID": cid}})
                existing_cw_ids.add(cid)

print(f"Fixing {len(fixes)} companies with missing CW IDs")
if fixes:
    p = batch_patch("tblqDN4s1r00mK1Us", fixes)
    print(f"  Fixed: {p}")

# STEP 3: Create missing companies from sheet
print("\n" + "=" * 60)
print("STEP 3: CREATE MISSING COMPANIES FROM SHEET")
print("=" * 60)

missing_from_sheet = []
for row in sheet_companies:
    cid = safe_int(row.get("CompanyID"))
    name = row.get("Name", "").strip()
    if not name: continue
    if cid and cid in existing_cw_ids: continue
    if name.lower() in existing_names_lower: continue
    missing_from_sheet.append(row)

print(f"Missing from sheet: {len(missing_from_sheet)}")
new_records = []
for row in missing_from_sheet:
    fields = {"Company Name": row.get("Name", "").strip()}
    cid = safe_int(row.get("CompanyID"))
    if cid: fields["CW Company ID"] = cid
    if row.get("Phone", "").strip(): fields["Phone"] = row["Phone"].strip()
    if row.get("AddressLine1", "").strip(): fields["Address"] = row["AddressLine1"].strip()
    if row.get("City", "").strip(): fields["City"] = row["City"].strip()
    if row.get("State", "").strip(): fields["State"] = row["State"].strip()
    if row.get("Zip", "").strip(): fields["Zip"] = row["Zip"].strip()
    if row.get("Website", "").strip(): fields["Website"] = row["Website"].strip()
    if row.get("Territory", "").strip(): fields["Territory"] = row["Territory"].strip()
    if row.get("Status", "").strip(): fields["Status"] = row["Status"].strip()
    if row.get("Type", "").strip(): fields["Type"] = row["Type"].strip()
    new_records.append({"fields": fields})
    if cid: existing_cw_ids.add(cid)

# STEP 4: Create orphan-only companies (referenced but not in sheet)
orphan_ids = {
    19331: "Vendor", 19328: "Microsoft", 19314: "Ingram Micro",
    19327: "Call Tower", 19325: "FedEX", 19296: "ConnectWise",
    19329: "MirrorWeb", 19364: "Life Capital Partners",
    19344: "Blueprint Local LLC.", 19330: "Archive Intel",
    19336: "Perspective Wealth Advisors", 19326: "Exclaimer Cloud",
    19313: "CDW", 19360: "Aspenridge Wealth Advisors",
    19332: "Goldman Sachs", 19309: "BlueSky IT Partners",
    19303: "True Test Company", 19352: "Santa Barabara Management",
    19365: "Stonebridge Financial Group", 19337: "Arrowsphere",
    19319: "Regere LLC", 19347: "Duo Security LLC",
    19358: "RBA Wealth Management", 19316: "QTR Family Wealth",
    19368: "San Francisco RIA", 19345: "3 Arch Wealth",
    19298: "Catchall", 19311: "Evernest Financial Advisors",
    19301: "DemoCompany", 19348: "Compass Solutions",
    19367: "Pasadena Trust & Estates", 19308: "Firewalls.com",
    19349: "Truman Wealth Advisors", 19305: "Spring Ridge Advisor Solutions",
    19370: "Endeavor Advisors", 19369: "Asempa Wealth Advisors",
    19363: "Aether Investment Partners", 19361: "Tesser Capital Management",
    19366: "Opentext/Appriver", 19353: "Crusonia Wealth Advisors LLC",
    19317: "Sound Financial Strategies Group, LLC",
    19322: "Integrity Wealth", 19297: "XYZ Test Company",
    19362: "A Ether IP", 19320: "Allegiant Wealth Advisors",
    19359: "Axtura", 19302: "DemoCompany",
}

extra = 0
for cid, name in orphan_ids.items():
    if cid not in existing_cw_ids:
        new_records.append({"fields": {"Company Name": name, "CW Company ID": cid}})
        extra += 1

print(f"Extra orphan companies: {extra}")
print(f"Total to create: {len(new_records)}")

if new_records:
    created = batch_create("tblqDN4s1r00mK1Us", new_records)
    print(f"  Created: {created}")

# STEP 5: Rebuild map and re-link
print("\n" + "=" * 60)
print("STEP 5: RE-LINK ALL ORPHANED RECORDS")
print("=" * 60)

time.sleep(1)
all_companies = fetch_all("tblqDN4s1r00mK1Us")
company_map = {}
for r in all_companies:
    cid = r["fields"].get("CW Company ID")
    if cid: company_map[int(cid)] = r["id"]
print(f"Company map: {len(company_map)} entries")

# Re-link Contacts
print("\nLinking Contacts...")
contacts = fetch_all("tblNP3badVrI2d7wD")
cu = [{"id": r["id"], "fields": {"Company": [company_map[int(r["fields"]["CW Company ID"])]]}}
      for r in contacts
      if not r["fields"].get("Company")
      and r["fields"].get("CW Company ID")
      and safe_int(r["fields"]["CW Company ID"]) in company_map]
print(f"  To link: {len(cu)}")
if cu: print(f"  Linked: {batch_patch('tblNP3badVrI2d7wD', cu)}")

# Re-link Tickets
print("\nLinking Tickets...")
tickets = fetch_all("tblB1iWQDfnpFQvJr")
tu = [{"id": r["id"], "fields": {"Company": [company_map[int(r["fields"]["CW Company ID"])]]}}
      for r in tickets
      if not r["fields"].get("Company")
      and r["fields"].get("CW Company ID")
      and safe_int(r["fields"]["CW Company ID"]) in company_map]
print(f"  To link: {len(tu)}")
if tu: print(f"  Linked: {batch_patch('tblB1iWQDfnpFQvJr', tu)}")

# FINAL VERIFICATION
print("\n" + "=" * 60)
print("FINAL VERIFICATION")
print("=" * 60)

for name, tid, lf in [
    ("Companies", "tblqDN4s1r00mK1Us", None),
    ("Contacts", "tblNP3badVrI2d7wD", "Company"),
    ("Tickets", "tblB1iWQDfnpFQvJr", "Company"),
    ("Configurations", "tblZagPZhzxfd2qVk", "Company"),
    ("Agreements", "tblI5rdw6kZRfus5L", "Company"),
    ("Members", "tblwrsU9Il2MmZLaA", None),
    ("Time Entries", "tbleUpCyd96EBK2Vh", "Ticket"),
    ("Products", "tblCpYgecs5Q3Zxn2", None),
]:
    recs = fetch_all(tid)
    if lf:
        linked = sum(1 for r in recs if r["fields"].get(lf))
        orphaned = len(recs) - linked
        pct = (linked / len(recs) * 100) if recs else 0
        print(f"  {name}: {len(recs)} records, {linked} linked ({pct:.0f}%), {orphaned} orphans")
    else:
        print(f"  {name}: {len(recs)} records")

print("\nDONE")
