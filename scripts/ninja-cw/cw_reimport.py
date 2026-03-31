import requests, json, sys, io, time, csv
from io import StringIO
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

TOKEN = "patkX3PmrObHeTNmn.78ae1da8f8cfd536c7d0f1403777be3e0be1110945dd82fa421b1932483ce9fa"
BASE_ID = "app6lhrz0MSMj95Dp"
SHEET_ID = "1E1wgzj2NqfO0bUUV8D1GQQNnlArK6VuuRwHRoiQ5JEQ"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
AUTH = {"Authorization": f"Bearer {TOKEN}"}

TABLES = {
    "Companies": "tblqDN4s1r00mK1Us",
    "Contacts": "tblNP3badVrI2d7wD",
    "Tickets": "tblB1iWQDfnpFQvJr",
    "Configurations": "tblZagPZhzxfd2qVk",
    "Agreements": "tblI5rdw6kZRfus5L",
    "Members": "tblwrsU9Il2MmZLaA",
    "Time Entries": "tbleUpCyd96EBK2Vh",
    "Products": "tblCpYgecs5Q3Zxn2",
}

GIDS = {
    "Tickets": 0,
    "Contacts": 1078337796,
    "Companies": 1647068601,
    "Configurations": 1378902069,
    "Agreements": 1660647286,
    "Members": 1840137223,
    "Time Entries": 1418549860,
    "Products": 1461875425,
}

def fetch_sheet(gid):
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={gid}"
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    reader = csv.DictReader(StringIO(r.text))
    return list(reader)

def fetch_all_records(table_id):
    records = []
    offset = None
    while True:
        params = {"pageSize": 100}
        if offset:
            params["offset"] = offset
        r = requests.get(f"https://api.airtable.com/v0/{BASE_ID}/{table_id}",
                        headers=AUTH, params=params, timeout=60)
        r.raise_for_status()
        data = r.json()
        records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            break
        time.sleep(0.2)
    return records

def delete_all(table_id, table_name):
    records = fetch_all_records(table_id)
    if not records:
        print(f"  {table_name}: already empty")
        return 0
    total = len(records)
    for i in range(0, total, 10):
        batch = records[i:i+10]
        ids = "&".join([f"records[]={r['id']}" for r in batch])
        requests.delete(f"https://api.airtable.com/v0/{BASE_ID}/{table_id}?{ids}", headers=AUTH, timeout=60)
        time.sleep(0.2)
    print(f"  {table_name}: deleted {total} records")
    return total

def batch_create(table_id, records, table_name):
    created = 0
    errors = 0
    for i in range(0, len(records), 10):
        batch = records[i:i+10]
        resp = requests.post(f"https://api.airtable.com/v0/{BASE_ID}/{table_id}",
                            headers=HEADERS, json={"records": batch, "typecast": True}, timeout=60)
        if resp.status_code == 200:
            created += len(resp.json().get("records", []))
        else:
            # Retry one by one
            for rec in batch:
                time.sleep(0.2)
                resp2 = requests.post(f"https://api.airtable.com/v0/{BASE_ID}/{table_id}",
                                     headers=HEADERS, json={"records": [rec], "typecast": True}, timeout=60)
                if resp2.status_code == 200:
                    created += 1
                else:
                    errors += 1
                    if errors <= 3:
                        print(f"    ERROR: {resp2.text[:200]}")
        time.sleep(0.2)
        if (i + 10) % 500 == 0:
            print(f"    ...{created} created so far", flush=True)
    print(f"  {table_name}: created {created}, errors {errors}")
    return created

def safe_int(val):
    try:
        return int(float(val))
    except:
        return None

def safe_float(val):
    try:
        return float(val)
    except:
        return None

# ══════════════════════════════════════════════════════════════
# PHASE 1: Import Companies (base table, no links needed)
# Companies look correct (63 vs 76 source — some filtered) — keep as-is
# But rebuild the company_id -> record_id map
# ══════════════════════════════════════════════════════════════
print("=" * 60)
print("PHASE 1: BUILD COMPANY LOOKUP MAP")
print("=" * 60)

company_records = fetch_all_records(TABLES["Companies"])
company_map = {}  # CW Company ID -> Airtable record ID
for r in company_records:
    cid = r["fields"].get("CW Company ID")
    if cid:
        company_map[int(cid)] = r["id"]
print(f"  Company map: {len(company_map)} entries")

# ══════════════════════════════════════════════════════════════
# PHASE 2: Flush and re-import Contacts with Company links
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("PHASE 2: RE-IMPORT CONTACTS (17 -> 393)")
print("=" * 60)

delete_all(TABLES["Contacts"], "Contacts")
sheet_contacts = fetch_sheet(GIDS["Contacts"])
print(f"  Source: {len(sheet_contacts)} rows")

contact_records = []
for row in sheet_contacts:
    name = f"{row.get('FirstName', '').strip()} {row.get('LastName', '').strip()}".strip()
    if not name:
        continue
    fields = {"Name": name}
    cid = safe_int(row.get("ContactID"))
    if cid:
        fields["CW Contact ID"] = cid
    if row.get("Email", "").strip():
        fields["Email"] = row["Email"].strip()
    if row.get("Phone", "").strip():
        fields["Phone"] = row["Phone"].strip()
    if row.get("Title", "").strip():
        fields["Title"] = row["Title"].strip()
    if row.get("CompanyName", "").strip():
        fields["Company Name"] = row["CompanyName"].strip()
    comp_id = safe_int(row.get("CompanyID"))
    if comp_id:
        fields["CW Company ID"] = comp_id
        if comp_id in company_map:
            fields["Company"] = [company_map[comp_id]]
    if row.get("DefaultPhoneType", "").strip():
        fields["Type"] = row["DefaultPhoneType"].strip()
    contact_records.append({"fields": fields})

batch_create(TABLES["Contacts"], contact_records, "Contacts")

# ══════════════════════════════════════════════════════════════
# PHASE 3: Flush and re-import Members
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("PHASE 3: RE-IMPORT MEMBERS (52 -> 31)")
print("=" * 60)

delete_all(TABLES["Members"], "Members")
sheet_members = fetch_sheet(GIDS["Members"])
print(f"  Source: {len(sheet_members)} rows")

member_records = []
for row in sheet_members:
    name = row.get("FullName", "").strip()
    if not name:
        name = f"{row.get('FirstName', '').strip()} {row.get('LastName', '').strip()}".strip()
    if not name:
        continue
    fields = {"Name": name}
    mid = safe_int(row.get("MemberID"))
    if mid:
        fields["CW Member ID"] = mid
    if row.get("OfficeEmail", "").strip():
        fields["Email"] = row["OfficeEmail"].strip()
    elif row.get("PrimaryEmail", "").strip():
        fields["Email"] = row["PrimaryEmail"].strip()
    if row.get("Title", "").strip():
        fields["Title"] = row["Title"].strip()
    if row.get("SecurityRole", "").strip():
        fields["Role"] = row["SecurityRole"].strip()
    inactive = row.get("InactiveFlag", "").strip().lower()
    fields["Active"] = "No" if inactive in ("true", "1", "yes") else "Yes"
    member_records.append({"fields": fields})

batch_create(TABLES["Members"], member_records, "Members")

# ══════════════════════════════════════════════════════════════
# PHASE 4: Flush and re-import Configurations with Company links
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("PHASE 4: RE-IMPORT CONFIGURATIONS (764 -> 382)")
print("=" * 60)

delete_all(TABLES["Configurations"], "Configurations")
sheet_configs = fetch_sheet(GIDS["Configurations"])
print(f"  Source: {len(sheet_configs)} rows")

config_records = []
for row in sheet_configs:
    name = row.get("Name", "").strip() or row.get("FriendlyName", "").strip()
    if not name:
        continue
    fields = {"Name": name}
    cid = safe_int(row.get("ConfigID"))
    if cid:
        fields["CW Config ID"] = cid
    if row.get("CompanyName", "").strip():
        fields["Company Name"] = row["CompanyName"].strip()
    comp_id = safe_int(row.get("CompanyID"))
    if comp_id:
        fields["CW Company ID"] = comp_id
        if comp_id in company_map:
            fields["Company"] = [company_map[comp_id]]
    if row.get("Type", "").strip():
        fields["Type"] = row["Type"].strip()
    if row.get("Status", "").strip():
        fields["Status"] = row["Status"].strip()
    if row.get("SerialNumber", "").strip():
        fields["Serial Number"] = row["SerialNumber"].strip()
    if row.get("ModelNumber", "").strip():
        fields["Model"] = row["ModelNumber"].strip()
    if row.get("Manufacturer", "").strip():
        fields["Manufacturer"] = row["Manufacturer"].strip()
    config_records.append({"fields": fields})

batch_create(TABLES["Configurations"], config_records, "Configurations")

# ══════════════════════════════════════════════════════════════
# PHASE 5: Flush and re-import Agreements with Company links
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("PHASE 5: RE-IMPORT AGREEMENTS (38 -> 19)")
print("=" * 60)

delete_all(TABLES["Agreements"], "Agreements")
sheet_agreements = fetch_sheet(GIDS["Agreements"])
print(f"  Source: {len(sheet_agreements)} rows")

agreement_records = []
for row in sheet_agreements:
    name = row.get("Name", "").strip()
    if not name:
        continue
    fields = {"Agreement Name": name}
    aid = safe_int(row.get("AgreementID"))
    if aid:
        fields["CW Agreement ID"] = aid
    if row.get("CompanyName", "").strip():
        fields["Company Name"] = row["CompanyName"].strip()
    comp_id = safe_int(row.get("CompanyID"))
    if comp_id:
        fields["CW Company ID"] = comp_id
        if comp_id in company_map:
            fields["Company"] = [company_map[comp_id]]
    if row.get("Type", "").strip():
        fields["Type"] = row["Type"].strip()
    if row.get("AgreementStatus", "").strip():
        fields["Status"] = row["AgreementStatus"].strip()
    if row.get("StartDate", "").strip():
        fields["Start Date"] = row["StartDate"].strip()
    if row.get("EndDate", "").strip():
        fields["End Date"] = row["EndDate"].strip()
    amt = safe_float(row.get("BillAmount"))
    if amt is not None:
        fields["Amount"] = amt
    agreement_records.append({"fields": fields})

batch_create(TABLES["Agreements"], agreement_records, "Agreements")

# ══════════════════════════════════════════════════════════════
# PHASE 6: Link existing Tickets to Companies
# (5438 records — don't re-import, just link by CompanyID)
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("PHASE 6: LINK TICKETS TO COMPANIES (5438 records)")
print("=" * 60)

ticket_records = fetch_all_records(TABLES["Tickets"])
print(f"  Total tickets: {len(ticket_records)}")

# Build ticket_id -> record_id map for Time Entries linking
ticket_map = {}
updates_needed = []
for r in ticket_records:
    tid = r["fields"].get("CW Ticket ID")
    if tid:
        ticket_map[int(tid)] = r["id"]
    comp_id = safe_int(r["fields"].get("CW Company ID"))
    if comp_id and comp_id in company_map and not r["fields"].get("Company"):
        updates_needed.append({"id": r["id"], "fields": {"Company": [company_map[comp_id]]}})

print(f"  Ticket map: {len(ticket_map)} entries")
print(f"  Tickets needing Company link: {len(updates_needed)}")

linked = 0
for i in range(0, len(updates_needed), 10):
    batch = updates_needed[i:i+10]
    resp = requests.patch(f"https://api.airtable.com/v0/{BASE_ID}/{TABLES['Tickets']}",
                         headers=HEADERS, json={"records": batch}, timeout=60)
    if resp.status_code == 200:
        linked += len(resp.json().get("records", []))
    time.sleep(0.2)
    if (i + 10) % 500 == 0:
        print(f"    ...{linked} linked so far", flush=True)

print(f"  Tickets linked to Companies: {linked}")

# ══════════════════════════════════════════════════════════════
# PHASE 7: Flush and re-import Time Entries with Ticket links
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("PHASE 7: RE-IMPORT TIME ENTRIES (11469 -> 10359)")
print("=" * 60)

delete_all(TABLES["Time Entries"], "Time Entries")
sheet_time = fetch_sheet(GIDS["Time Entries"])
print(f"  Source: {len(sheet_time)} rows")

time_records = []
for row in sheet_time:
    fields = {}
    eid = safe_int(row.get("EntryID"))
    if eid:
        fields["CW Time ID"] = eid
    tid = safe_int(row.get("TicketID"))
    if tid:
        fields["CW Ticket ID"] = tid
        if tid in ticket_map:
            fields["Ticket"] = [ticket_map[tid]]
    if row.get("MemberName", "").strip():
        fields["Member"] = row["MemberName"].strip()
    if row.get("CompanyName", "").strip():
        fields["Company Name"] = row["CompanyName"].strip()
    hrs = safe_float(row.get("ActualHours"))
    if hrs is not None:
        fields["Hours"] = hrs
    if row.get("TimeStart", "").strip():
        fields["Date"] = row["TimeStart"].strip()
    if row.get("Notes", "").strip():
        notes = row["Notes"].strip()[:100000]
        fields["Notes"] = notes
    if row.get("WorkType", "").strip():
        fields["Work Type"] = row["WorkType"].strip()
    if fields:
        time_records.append({"fields": fields})

print(f"  Importing {len(time_records)} Time Entry records...")
batch_create(TABLES["Time Entries"], time_records, "Time Entries")

# ══════════════════════════════════════════════════════════════
# FINAL REPORT
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("FINAL VERIFICATION")
print("=" * 60)

for name, tid in TABLES.items():
    records = fetch_all_records(tid)
    # Count links
    linked_count = 0
    link_field = None
    if name == "Contacts":
        link_field = "Company"
    elif name == "Tickets":
        link_field = "Company"
    elif name == "Configurations":
        link_field = "Company"
    elif name == "Agreements":
        link_field = "Company"
    elif name == "Time Entries":
        link_field = "Ticket"

    if link_field:
        linked_count = sum(1 for r in records if r["fields"].get(link_field))
        pct = (linked_count / len(records) * 100) if records else 0
        print(f"  {name}: {len(records)} records, {linked_count} linked ({pct:.0f}%)")
    else:
        print(f"  {name}: {len(records)} records")

print("\n" + "=" * 60)
print("COMPLETE")
print("=" * 60)
