# Paylidify — CoPilot API Integration Reference
## Compiled 2026-04-06

---

## Authentication

Two-step model:

### Step 1 — Get Bearer Token
```
POST https://api.cardconnect.com/copilot/token
Authorization: Basic <base64(copilot_username:copilot_password)>
Content-Type: application/json
```
Response: `access_token` (Bearer), `token_type`, `expires_in` (seconds)

### All Subsequent Requests
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Credentials:** Stored in Azure Key Vault `kvdaxdakonapilot`
- Pipedrive API token: secret `paylidify-pipedrive-api-token`
- CoPilot credentials: TBD (to be stored as `paylidify-copilot-username` / `paylidify-copilot-password`)

---

## API Workflow (5 Steps)

| # | Step | Method | Endpoint | Status |
|---|------|--------|----------|--------|
| 1 | Authenticate | POST | /copilot/token | ✅ Building |
| 2 | Create Merchant | POST | /copilot/merchant | ✅ Building |
| 3 | Upload Attachments | POST | /copilot/attachment/{merchantId} | ⚠️ Manual (SOW) |
| 4 | Request Signature | PUT | /copilot/signature/{merchantId} | ❌ SKIP |
| 5 | Monitor Status | GET | /copilot/merchant/{merchantId} | Nice-to-have |

---

## CoPilot Portal Config (Confirmed from portal 2026-04-06)

```
Partner ID:         900583
Partner Name:       Paylidify
Partner Type:       Retail ISO
Agent ID:           1460950
Sales Code:         RISO-JC9N-HOUSEX91881
Sponsor Bank:       Wells Fargo (WELLS)
Application Platform: FirstData North
Hierarchy:
  Descriptor:       Paylidify - 2
  Business Chain:   498123456887
  Bank Chain:       498980374884
  Agent Chain:      498971291881
Portal URL:         https://copilot.cardconnect.com
```

### Account Templates (5 available)
```
Cost +
Surcharge
Swipe Non-Swipe
Merchant Services
CardPointe Only
```

Template selection maps from Pipedrive "Pricing Model" field:
- "Interchange Cost-Plus" → "Cost +"
- "Flat Rate Surcharge (3%)" → "Surcharge"
- "Swiped vs Non-Swiped (3%/4%)" → "Swipe Non-Swipe"
- "Flat Rate Cash Discount (4%)" / "Flat Rate Dual Pricing (4%)" → "Merchant Services" (TBC)
- Default → flag for manual review

---

## Pipedrive Field Keys

### Trigger
- Pipeline: **Onboarding**
- Trigger Stage: **Submitted to Underwriting** = Stage ID `123`
- Filter Field: **Processor Back End** = `495f2a4bdd8101967d7ac09f31de273c06543fcd`
  - Values to match: "First Data North", "TSYS"

### Deal Fields (CoPilot Mapping)
```
CoPilot Template ID        85cd1646c7a91937232185e6be50974e799e0592
Sales Rep Code             bc76c81b9f507b2d12dcd7c8fd62d1d8b6d28b4d
Sponsor Bank               1f4056d996403f59b9bd987db200479a35b09145
Business Chain ID          b79ab032d35ccfca3e811c653c2ebd87f3807db1
Bank Chain ID              f73ebe211b72202ac00743acdc3d7e012a5af9d3
ISO Sales ID/Agent Chain   c1382d933552db01b250c192818a1f533515ae30
Tax Filing Method          e1cc9701d5cc63cca9de2b6351b8e30b7bbcc1ac
EIN                        91bef194f847e4531aa8b6793d9173d139b11dac
Pricing Model              d2fcfcabdbc1050eda91a77f65db8699377caeeb
Annual Processing Vol      27aab3561c2a48e3ba9d4f4edc6cad2e7f30a83f
Average Ticket             f09aa4d855794cbca0a406c390c6ec32cda07157
Highest Ticket             510dd300ae17538fdfd4f7a29f7013fcdbca2a52
Card Present %             2338187b22797d570b76d491d36726e82aec7587
Card Not Present %         0ceef62faa75e49b84a494bece4872e74e2be1c8
Business Description       67588a5ca7458a43fb13a740ec42a901ce2b5133
Same-Day Delivery %        f077160b36fb231ba11ec21f088a454733756f8c
0-7 Day Delivery %         17b0b226735a514361befc76271b9090a32996cd
8-14 Day Delivery %        b6829bf479885199f4f73a804b4e3f7efc9b1df9
D.O.B (on deal)            e58809cb5903d0ab29f5f8d253518925d086bb73
TAX ID (on deal)           3faa6b8d8bd947b27789173d15b98d12f72eb3d8
Website (on deal)          d7d1d83a296318ee3fc3ca325ab49d6033faa9a8
Address (on deal)          ca25a2226fcf0a773147803a2286f95c7d2f2ee8
City (on deal)             4daaf1c8728b26aa5dc79f7eab5f4bc3a71c9762
State (on deal)            a463ac01a75b5986976906aea9bf048ce61867da
Zip Code (on deal)         273fe1495422cfffcd9eec1186d45d4d6a2d0fbb
Processor Back End         495f2a4bdd8101967d7ac09f31de273c06543fcd
Processor Back End MID     f88527af56b9114a4a6bb73b05ab9692900a65b7
Account Status             76ea755b59f5ca5f98bac800b9ea439182262095
```

### Organization Fields
```
DBA                        d53770281e38bcdae68336df424df4ad989fc67c
Legal Business Name        721f8dbe32888708186174ae0a0ea186917d5fcd
Tax Filing Name            db33fcb6884aa8cc11f589d43c05ba0f56440204
Business Address 1         df137e4026144dc3266fede7b6632d5ad64a83ab
Business Address 2         159c1e83b28e907df93474b045440bf595d9f663
City                       820c3d4ac5566e1d44b914b603408d775d579b64
State                      98129f33144076c2191cbbcd8253dcd02dac74eb
Zip Code                   34f7f8aa5ad0307896e6aac465bf7909fd224e09
Country                    b927252af43c098738c04d9d2d9cc951ad3ad193
Mailing Address 1          f9e63b8a898e5370743cc1b3c1ae1655c98c4bfd
Mailing Address 2          27fb98c3fc0a8a0f6489393a71a0eada2118bfec
Mailing City               cbdd6067029f9167f62d4dba1d4679551a8ea9af
Mailing State              2b996396ccd996e5cbd6f8f713d1267d47ce4067
Mailing Zip Code           f474656ed09a2328cbdcb50fd47e5c1b9a70a979
Mailing Country            6224866d686e8371efcb93d0c0d6d58a9806ca47
Business Phone             a2c6a7e1ed15d2a03e80096a72830f22811b5ff4
Business Email             2cb5c05c72cf9224ca949dc15fc2c4ddb593a356
MCC/SIC                    539c4cf77ca6b7942d8d65a7c5fd57f82c2cdc73
Business Start Date        a9605ca65a3aeea6a2616c3a6d5483c4ea1d0f9c
Merchant Time Zone         2b77bdb800cb500da16ed7546783f2a51ea50400
Website                    c8e856280b3797e66098e8dcb9d8383976658771
Org Type                   eb81767f94d2f4da045c846174a5b447277108b9
```

### Person Fields (Owner)
```
Owner Name                 360420d9ae6e67821593c3f8b9c39edc32275457
Owner Title                af74f90fdb17d24829624bf1681892f61929d414
Owner Email                e367d23d124406b7cf78d108055fb94dfe5526bb
Owner Phone                6a2d42f46659881206c4965e12698ee7a9bcf917
Owner DOB                  815097fae1cac53c9ddc75be4dfcc076c968b9cf
Owner Address 1            83f85366426f4a041125ab3938f6ebed9aba1002
Owner Address 2            c9d51dd63ff329d58147f7f82a48511a8048a5eb
Owner City                 6c4460a5921edec76ad20a3ec2c7ba3e2400426a
Owner State                318b0c914bb7e036a15ff48e7fdccd41ba93447b
Owner Zip Code             be766c0826f849ebf1740276e0bd3e26da6c4001
Owner Country              75bcdda89f0577ba610b34e252b952f13e212cdf
Ownership Type             db546d26b8d927fadc9425e58b379f4caec0e3fe
Ownership %                dd81c085ad0a9d34dbf22f77de0628b510463a51
Drivers License #          e6953469a22306c20c3296179bea5efd69d58ed4
DL State                   cecc18de7ef8334d83ff0b8e1de8c0b02b232c2e
First Name                 21fcb938081087434f79a8a0daa610fa359840c6
Last Name                  00bbda61a8ba931032148199f7a0ac6c53bea3d6
```

### Missing Fields (Need from Adam or need to create)
- Bank Account # (encrypted)
- Bank Routing #
- Bank Name / Account Type
- Discount Rate, Per Transaction Fee, Monthly Fee, Platform Code
- Owner SSN (encrypted)
- Boarding Status (writeback field)
- CoPilot Merchant ID (writeback field)

---

## Complete JSON Payload Structure

```json
{
  "templateId": "{{copilot_template_id}}",
  "merchant": {
    "salesCode": "{{paylidify_sales_code}}",
    "dbaName": "",
    "legalBusinessName": "",
    "taxFilingName": "",
    "taxFilingMethod": "EIN",
    "taxId": "",
    "businessStartDate": "MM/DD/YYYY",
    "businessIdTypeCd": "LLC",
    "mcc": "",
    "hierarchy": {
      "corpLevel": "",
      "chainLevel": "",
      "sponsorBankCd": "WELLS"
    },
    "demographic": {
      "businessPhone": "",
      "websiteAddress": "",
      "merchantTimeZone": "CT",
      "businessIncorporatedStateCd": "",
      "businessAddress": {
        "address1": "",
        "address2": "",
        "city": "",
        "stateCd": "",
        "zip": "",
        "countryCd": "US"
      },
      "mailingAddress": {
        "address1": "",
        "address2": "",
        "city": "",
        "stateCd": "",
        "zip": "",
        "countryCd": "US"
      }
    },
    "ownership": {
      "ownershipTypeCd": "",
      "ownerOwnershipPct": 100,
      "driversLicenseNumber": "",
      "driversLicenseStateCd": "",
      "publiclyTradedFlag": false,
      "owner": {
        "ownerName": "",
        "ownerTitle": "",
        "ownerEmail": "",
        "ownerPhone": "",
        "ownerMobilePhone": "",
        "ownerDob": "MM/DD/YYYY",
        "ownerSSN": "",
        "ownerAddress": {
          "address1": "",
          "city": "",
          "stateCd": "",
          "zip": "",
          "countryCd": "US"
        }
      }
    },
    "bankDetail": {
      "depositBank": {
        "bankName": "",
        "bankAcctNum": "",
        "bankRoutingNum": "",
        "bankAcctTyp": "CHECKING"
      }
    },
    "processingInfo": {
      "annualVolume": 0,
      "averageTicket": 0,
      "highestTicket": 0,
      "cardPresentPct": 0,
      "cardNotPresentPct": 0,
      "businessDescription": ""
    },
    "deliveryPercentages": {
      "dlvrySameDayPct": 0,
      "dlvry0To7DaysPct": 0,
      "dlvry8To14Days": 0
    },
    "platformDetails": {
      "platformCd": "FD",
      "pricingPlan": "INTERCHANGE_PLUS",
      "discountRate": 0,
      "transactionFee": 0,
      "monthlyFee": 0
    }
  }
}
```

---

## Attachment Upload (Post-Merchant Creation)
```
POST https://api.cardconnect.com/copilot/attachment/{merchantId}
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
Body: { "file": <binary PDF>, "documentType": "SIGNED_APPLICATION" }
```
Repeat for: voided check (`VOIDED_CHECK`), photo ID (`PHOTO_ID`)

---

## Security & PII Handling
| Field | Requirement |
|-------|-------------|
| Owner SSN | Pipedrive encrypted field, admin-only, never log, HTTPS only |
| Bank Account # | Pipedrive encrypted field, retrieve only at submission, no caching |
| Date of Birth | Admin-restricted, GLBA/PCI |
| Driver's License | Restricted, exclude from exports |
| Bearer Token | Never store in Pipedrive, refresh before expiry |
| CoPilot Credentials | Azure Key Vault only, rotate quarterly |

---

## n8n Workflow
- File: `clients/paylidify/n8n/copilot-boarding-workflow.json`
- 8-node happy path + 3-node error path
- Status: Skeleton built, field keys being wired in
