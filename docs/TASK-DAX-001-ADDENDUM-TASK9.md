
### Task 9 — Link DAX to ICP CompanyDrive SharePoint (15 min)

Brett's team uses `https://impactcapitalpartnersllc.sharepoint.com/sites/CompanyDrive` as their shared document library — NOT the root SharePoint site. DAX must save documents here so the team actually sees them.

Steps:
1. Get the Site ID for CompanyDrive:
```
GET https://graph.microsoft.com/v1.0/sites/impactcapitalpartnersllc.sharepoint.com:/sites/CompanyDrive?$select=id,displayName,webUrl
```
2. Create a "DAX" folder inside CompanyDrive (or "DAX Documents" + "DAX Reports" + "DAX Templates")
3. Update the `GRAPH_SITE_ID` env var on vm-n8n-icp to point to this CompanyDrive site ID
4. Update all Graph API calls in the Router and sub-workflows to use the new site ID
5. Verify: ask DAX to "write a 500 word article about Tesla and save it" — confirm the file appears in CompanyDrive/DAX Documents
6. Confirm Brett's team can see the file at `https://impactcapitalpartnersllc.sharepoint.com/sites/CompanyDrive`

CompanyDrive URL: `https://impactcapitalpartnersllc.sharepoint.com/sites/CompanyDrive`

This is critical — if documents save to a SharePoint site nobody uses, the feature is invisible.
