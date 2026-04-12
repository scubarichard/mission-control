# Gate 4 — E2E Test Instructions
# Written by Dax/Sonnet — Atlas to execute immediately

BASE_ID = appDqWxcM86CpBHoQ
Token from: P:/_clients/pnt-central-brain/.env (AIRTABLE key)
OR on Linux: /home/daxadmin/.openclaw/workspace/.env or check where the token is stored

## Tables
- Expenses: tblhsuyym7ITGgBOa
- Guide_Payroll: tblROIGwkn4eSWiSR
- Bookings: tbl9ofYOg4Uckcl6m
- Guides_Staff: (look up from /v0/meta/bases/appDqWxcM86CpBHoQ/tables)

## Steps

### 1. Schema check
GET /v0/meta/bases/appDqWxcM86CpBHoQ/tables
Verify Expenses has: Guide Payroll, Paid By, Receipt (newly added)
Verify Guide_Payroll has: Days Worked, Payment Date, Total Pay, Total Reimbursement, Total Payout (newly added)
Verify Bookings has: Total Expenses (newly added)

### 2. Get a real seeded booking ID
GET https://api.airtable.com/v0/appDqWxcM86CpBHoQ/Bookings?maxRecords=1
Save the record ID as BOOKING_ID

### 3. Get a real Guides_Staff record ID
GET https://api.airtable.com/v0/appDqWxcM86CpBHoQ/Guides_Staff?maxRecords=1
Save as GUIDE_ID

### 4. Create Guide_Payroll test record
POST https://api.airtable.com/v0/appDqWxcM86CpBHoQ/Guide_Payroll
{
  "fields": {
    "Booking": [BOOKING_ID],
    "Guide": [GUIDE_ID],
    "Days Worked": 5,
    "Daily Rate": 180,
    "Status": "Pending"
  }
}
Save as PAYROLL_ID

### 5. Create Expense record A (Guide, reimbursable)
POST https://api.airtable.com/v0/appDqWxcM86CpBHoQ/Expenses
{
  "fields": {
    "Booking": [BOOKING_ID],
    "Guide Payroll": [PAYROLL_ID],
    "Category": "Guide",
    "Amount": 45,
    "Paid By": "Guide",
    "Status": "Pending"
  }
}
Save as EXPENSE_A_ID

### 6. Create Expense record B (Taxi, PNT pays)
POST https://api.airtable.com/v0/appDqWxcM86CpBHoQ/Expenses
{
  "fields": {
    "Booking": [BOOKING_ID],
    "Category": "Taxi",
    "Amount": 120,
    "Paid By": "PNT",
    "Status": "Pending"
  }
}
Save as EXPENSE_B_ID

### 7. Read back and verify
GET Payroll record PAYROLL_ID — verify Booking and Guide links present
GET Expense A — verify Booking, Guide Payroll, Category, Paid By all correct
GET Expense B — verify Booking, Category, Paid By correct

### 8. Clean up
DELETE EXPENSE_A_ID
DELETE EXPENSE_B_ID  
DELETE PAYROLL_ID

### 9. Post results to #dax-collab (C0APVGG486M)
Format:
GATE 4: PASS or FAIL
- Expenses schema: pass/fail (list new fields found)
- Guide_Payroll schema: pass/fail (list new fields found)
- Bookings Total Expenses: pass/fail
- Payroll record created + linked: pass/fail
- Expense A (Guide/reimbursable): pass/fail
- Expense B (Taxi/PNT): pass/fail
- Links verified: pass/fail
- Cleanup: pass/fail
