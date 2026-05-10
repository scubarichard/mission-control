# Activation & Delivery Checklist — Chosen Agency V1

Follow top to bottom. Every item is a single click or copy-paste. No decisions required.

---

## PRE-FLIGHT (5 min)

**1. Verify all 3 Make scenarios exist:**
- [ ] `Chosen Agency - Content Pipeline V1` (id 4894796) — currently INACTIVE
- [ ] `Chosen Agency - HeyGen Webhook Receiver` (id 5020000) — currently INACTIVE
- [ ] `Chosen Agency — Render Checker` (id 5021116) — currently INACTIVE

Open Make.com → Scenarios → confirm all 3 are listed.

**2. Verify the V1 sheet exists and has test rows:**
- [ ] Open https://docs.google.com/spreadsheets/d/1reHZpPcnGy2PTXTqKTdR-otnbqEeRfDkhG3dR-yfHWo
- [ ] Confirm Queue tab has rows 2-10 with Status=Done

---

## RECORD LOOMS (~30 min including retries)

**3. Read the scripts in `clients/chosen-agency/docs/loom_scripts.md`** — once each, in order. Don't memorize, just understand the flow.

**4. Set up screen recording:**
- [ ] Loom desktop app open
- [ ] Browser tabs ready: V1 sheet, Make scenario 4894796 in edit mode, Drive `10_Documentation` folder
- [ ] Quiet room, headset mic preferred over laptop mic

**5. Record Loom 1 — Full System Walkthrough** (5-6 min)
- [ ] Hit record
- [ ] Follow the script in loom_scripts.md
- [ ] Stop, save, set sharing to "anyone with the link"
- [ ] Copy URL → paste here: ___________________________

**6. Record Loom 2 — V1 Scenario Module-by-Module** (4 min)
- [ ] Hit record
- [ ] Follow the script
- [ ] Stop, save, share
- [ ] Copy URL → paste here: ___________________________

**7. Record Loom 3 — Daily Operator Flow** (2-3 min)
- [ ] Hit record
- [ ] Follow the script
- [ ] Stop, save, share
- [ ] Copy URL → paste here: ___________________________

---

## ACTIVATE PIPELINE (2 min)

Order matters. Webhook needs to be live BEFORE V1, so callbacks aren't dropped.

**8. Activate Webhook scenario (id 5020000):**
- [ ] Open scenario in Make → toggle Active = ON
- [ ] Confirm "Active" badge appears

**9. Activate Render Checker scenario (id 5021116):**
- [ ] Open scenario in Make → toggle Active = ON
- [ ] Confirm next-execution time appears (every 5 min)

**10. Activate V1 scenario (id 4894796):**
- [ ] Open scenario in Make → toggle Active = ON
- [ ] Confirm next-execution time appears (every 15 min)

---

## SEND TO ERIKA (5 min)

**11. Open `clients/chosen-agency/docs/delivery_message.md`**

**12. Paste the three Loom URLs** into the placeholders `[LOOM URL 1]`, `[LOOM URL 2]`, `[LOOM URL 3]`.

**13. Copy the entire message body** (everything between `## Body` and `— Richard`, inclusive).

**14. Open Upwork → Erika Cobb's contract → Messages.**

**15. Paste and send.**

**16. After sending, mark Milestone 2 work as submitted on Upwork.**

---

## AFTER ERIKA RESPONDS

**If she approves:**
- [ ] Apply for milestone release on Upwork
- [ ] When the funds clear, archive the Chosen Agency project folder in Drive
- [ ] Add Chosen Agency to your portfolio site as a case study

**If she requests changes:**
- [ ] Read the request carefully — don't react fast
- [ ] If it's covered in the SOW, do it
- [ ] If it's outside the SOW (Section 12 Phase 2+ scenarios), respond: "Happy to scope that as a follow-on engagement — would you like a quote?"
- [ ] Don't accept Phase 2 work for free, even if it sounds small

**If she goes silent for more than 7 days:**
- [ ] Follow up once with: "Hi Erika, just checking if you've had a chance to review the V1 delivery. Let me know if you need anything to help acceptance."
- [ ] If still silent after 14 days from delivery, apply for milestone release with the dispute reason "work delivered, no response from client"

---

## KILL SWITCH (if anything goes wrong while active)

If you see something weird while the pipeline is active and you need to stop everything fast:

1. Open Make.com
2. Toggle V1 (4894796) to Inactive — stops new submissions
3. Wait 2 minutes for any in-flight render to finish or fail
4. Toggle Webhook (5020000) to Inactive
5. Toggle Render Checker (5021116) to Inactive

System is now fully stopped. No data loss — rows in flight will resume when you reactivate.

---

## CREDENTIAL HANDOFF (when Erika is ready to take ownership)

Follow `clients/chosen-agency/docs/credential_map.md` Section 5. The 5-step procedure swaps your API keys for hers without breaking the running pipeline.

This is a separate task from this checklist. Don't do it as part of delivery — wait until she explicitly asks to take ownership.
