
---

## TASK-20260512-TRITON-AUTOVID-001 — Full-auto catalog video for item 31 (Make.com Pipeline Diagnostic service)

- **Assignee:** Triton
- **Status:** PENDING
- **Priority:** Medium
- **From:** [Sonnet]
- **Project:** 1AltX catalog item 31 — Make.com Pipeline Diagnostic service offering video
- **Repo:** `scubarichard/dax` (this repo for task tracking); `scubarichard/1altx-site` for catalog.json update; `scubarichard/techwalkmint` for methodology
- **Branch:** create `auto/catalog-31-production` from `main` on 1altx-site for the catalog.json change

### Context

Following the close of the Dew Wealth Phase 1 engagement (May 12), 1AltX is positioning a new productized diagnostic service offering: structural diagnostics of Make.com pipelines for regulated firms (RIAs, family offices, accounting). The TechWalkMint methodology has been extended to document the diagnostic engagement variant. We now need a catalog video to market this service alongside the existing 30 catalog videos.

The video uses a hybrid production pattern: CatalogMint wrapper (intro/title/CTA/outro scenes — consistent with existing catalog items) wrapped around a TechWalkMint-produced Scene 03 (script + slides + voiceover — required because there's no automation-running screen recording for a service offering).

Full production brief: `clients/1altx/tasks/catalog-31-full-auto.md`

### Build

Execute the production brief end-to-end with NO human intervention. Internal QA gates replace the human review checkpoints. YouTube upload is UNLISTED only (Richard reviews the final video before flipping to Public).

High-level phases (full detail in brief):
1. Draft script + slides with internal QA (3 candidate scripts, self-evaluation, retry on failure)
2. Render assets (ElevenLabs audio, HeyGen avatar, PIL slide images)
3. Assemble final video (FFmpeg concat, loudness normalize)
4. Sanitization HARD GATE (cross-reference against private-mapping.md client names)
5. Publish (YouTube unlisted, catalog.json update, GitHub push)
6. Self-review (quality scoring)
7. Notify (email completion report to richard@1altx.com)

### Acceptance Criteria

1. Final MP4 is between 4:00 and 5:30 in duration
2. YouTube video uploaded as UNLISTED (never Public)
3. catalog.json updated with item 31 entry (status: published)
4. Commit pushed to scubarichard/1altx-site main branch
5. Email sent to richard@1altx.com with unlisted URL + quality scores + cost summary
6. Production log appended at `~/Dropbox/Companies/1AltX/Projects/_internal/catalogmint/production-log.md`
7. Hybrid pattern documented and committed to techwalkmint repo as `references/catalog-hybrid-pattern.md`

### Out of Scope

- Do NOT flip YouTube visibility to Public — Richard does that manually after review
- Do NOT modify any existing catalog items (01-30)
- Do NOT modify CatalogMint scripts themselves — reuse as-is
- Do NOT skip the Phase 4 sanitization gate even if appearing redundant
- Do NOT name any real clients in script, slides, or metadata
- Do NOT bump rates or change positioning language in the script — use the offering description from the brief verbatim

### Notes

- **Asset access:** CatalogMint scripts and Dropbox folder live on Windows (Forge has direct access). Triton is the assigned executor. Triton (Linux Surface laptop) will need to either (a) clone the catalogmint scripts from the Windows Dropbox folder via SMB / rsync, or (b) hand off Phase 2-3 rendering steps to Forge (which has direct local access to CatalogMint). Triton handles Phase 1 (script + slide drafting) and Phases 4-7 (sanitization, publish, notify); Forge can be invoked mid-task for rendering if needed.
- **Credentials:** All API keys in Azure Key Vault `kvdaximpactcapital` and `kvdaxdakonapilot`. Service principal access required.
- **Estimated runtime:** 30-50 minutes start to finish
- **Estimated cost:** $5-12 (HeyGen + ElevenLabs combined)
- **Hard cost ceiling:** Abort if projection exceeds $25
- **Reusability:** This task and the brief at `clients/1altx/tasks/catalog-31-full-auto.md` are templates for future service-offering catalog videos. Future items (32, 33, ...) just substitute the "Service offering" block at the top of the brief.

### Questions / Blockers

None at queue time. If the executing agent (Triton or Forge) hits a blocker, post here with `### [Triton] BLOCKER YYYY-MM-DD HH:MM` and flip status to `BLOCKED_BY_XXX` if dependent on another task.
