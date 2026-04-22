# TASK-1ALTX-010 Results — PVC (Proposal Video Creator) Pipeline Handover

**Status:** DONE (Sonnet session, 2026-04-21)
**Completed:** 2026-04-21
**Agent:** SONNET (handover for FORGE)
**Session:** Conversation with Richard on 2026-04-21

## Summary

Built and documented the full Proposal Video Creator (PVC) pipeline for UpWork outreach videos. Pipeline records 30-second screen captures of UpWork job pages, overlays a green-screen talking head via FFmpeg chromakey, and tracks output paths in the UpWork_Log sheet. 97 videos rendered end-to-end during the session.

This handover gives Forge everything needed to maintain, extend, or rebuild the pipeline.

---

## Pipeline Architecture

```
┌──────────────────────────────────────┐
│ record_videos.py                     │
│   Reads: UpWork_Log (col B URL)      │
│   Uses: Chrome CDP on port 9222      │
│   Writes: row{N}_{url-slug}.mp4      │
│   Updates: col V with filename       │  ← NOTE: collision with Descript URL col
└──────────────┬───────────────────────┘
               │ 1280x720 @ 2fps, 30s, silent
               ▼
┌──────────────────────────────────────┐
│ overlay_batch.ps1                    │
│   Reads: row{N}_{url-slug}.mp4       │
│   Applies: chromakey + despill +     │
│            talking-head overlay      │
│   Writes: row{N}_overlay.mp4         │
└──────────────┬───────────────────────┘
               │ 1280x720 @ 30fps, 33s, with TH audio
               ▼
┌──────────────────────────────────────┐
│ populate_aj.ps1                      │
│   Scans filesystem for overlays      │
│   Matches job ID from filename to    │
│   UpWork link (col B) in sheet       │
│   Writes local path to col AJ        │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ MANUAL: Upload to Descript           │
│   User drags MP4 into Descript,      │
│   publishes, copies share URL        │
│   Pastes into col AK                 │
└──────────────────────────────────────┘
```

---

## File Inventory

Location: `C:\Users\18473\Tools\autovid-outreach\`

| File | Size | Purpose |
|------|------|---------|
| `config.json` | 1.2 KB | Centralized paths, sheet IDs, FFmpeg spec |
| `record_videos.py` | 7 KB | Screen recorder (Forge-built 2026-04-21 AM) |
| `overlay_batch.ps1` | 3.2 KB | Talking-head chromakey + overlay |
| `populate_aj.ps1` | 2.7 KB | Writes local paths to sheet col AJ |
| `run_pipeline.ps1` | 5.2 KB | Orchestrator (record → overlay → populate) |
| `service_account.json` | 2.3 KB | Google Sheets API creds |
| `descript_token.txt` | pending | Descript API token (from KV `descript-api-token`) |
| `README.md` | 6 KB | Usage docs |
| `upload_log.csv` | 1.1 KB | Historical upload log (YouTube — legacy) |
| `youtube_*.json/.ps1` | — | **LEGACY** — YouTube upload abandoned, can delete |

---

## FFmpeg Spec (locked in config.json)

**Filter chain:**
```
[0:v]fps=30,tpad=stop_mode=clone:stop_duration=5[bg];
[1:v]chromakey=0x00FE00:0.15:0.10,despill=type=green:mix=0.5:expand=0,scale=640:-1[th];
[bg][th]overlay=W-w-20:H-h-20[v]
```

**Why each part:**
- `fps=30` — upsamples 2fps raw recording to smooth 30fps (matches TH motion)
- `tpad stop_duration=5` — extends raw 30s recording to 35s to cover TH audio (33s)
- `chromakey=0x00FE00:0.15:0.10` — pure green key with similarity 0.15, blend 0.10
- `despill=type=green:mix=0.5:expand=0` — kills green halo on TH subject edges
- `scale=640:-1` — TH sized to 640px wide (50% of 1280px frame)
- `overlay=W-w-20:H-h-20` — positions TH bottom-right, 20px margins
- `-t 33` — caps output at 33s (TH audio length)

**Output encoding:**
- `libx264 preset=fast crf=20`
- `aac 128k` (TH audio passed through)

---

## Sheet Column Map

Sheet ID: `11cydvXB7zb38FGSqrLTXEnikIK5gec1FSe3nK3Hy_BY`, gid `388267327`

| Col | Header | Purpose | Writer |
|-----|--------|---------|--------|
| B | UpWork Link | Job URL with `~{jobID}` | 7A |
| N | Status | Must not be "done" for recording to fire | Manual / 7B |
| V | Video | **ISSUE — see below** | Inconsistent |
| AJ | Local Video Path | Absolute path to overlay MP4 | populate_aj.ps1 |
| AK | Descript Share URL | Final URL for prospect | Manual |

### ⚠ KNOWN ISSUE — Column V collision

`record_videos.py` writes **local filenames** to col V (line 165: `sheet.update_cell(row_num, VIDEO_COL, filename)`).

But col V was originally designed to hold **Descript share URLs** (per TASK-1ALTX-008). Rows 2-33 still have Descript URLs; rows 34-41 have local filenames (because the recorder ran on them).

**Recommended fix (pending):**
- Change `VIDEO_COL` in record_videos.py from 22 (V) to a different column (e.g., a new "Recording Filename" col or just remove sheet-write entirely — use filesystem as source of truth)
- Or: decide col V is the new "local filename" column and move existing Descript URLs to col AK

Current workaround: populate_aj.ps1 uses col B (UpWork link + job ID regex) to match, not col V. So the collision doesn't break current pipeline, but it's a data integrity issue.

---

## Dependencies

**System-wide installs (done 2026-04-21):**
- Python 3.12.7 at `C:\Python312\` (system PATH)
- pip packages: `gspread 6.2.1`, `google-auth`, `google-auth-oauthlib`, `google-auth-httplib2`
- Node.js v24.14.0 (pre-existing)
- FFmpeg at `C:\Users\18473\Tools\ffmpeg\ffmpeg.exe` (pre-existing)

**Runtime requirements:**
- Chrome launched with `--remote-debugging-port=9222 --user-data-dir="C:\ChromeDebug"`
- User must be logged into UpWork in that Chrome before recording starts
- Cloudflare challenge passed manually (script detects "just a moment" title and waits 12s)

**Auth:**
- Google Sheets: service account `n8n-sheets@positive-bonbon-478413-p1.iam.gserviceaccount.com` has editor access
- Descript API token: stored in Azure KV `kvdaxdakonapilot` as `descript-api-token`
  - Format: `dx_bearer_{uuid}:dx_secret_{uuid}`
  - Validated working against `https://descriptapi.com/v1/jobs` during session

---

## Usage

**Full pipeline:**
```powershell
cd C:\Users\18473\Tools\autovid-outreach
.\run_pipeline.ps1
```

**Re-record specific rows** (clears col V first, then runs full pipeline):
```powershell
.\run_pipeline.ps1 -ReRecord 61,65,79,87,107,108,109,110
```

**Stage-skip flags:**
```powershell
.\run_pipeline.ps1 -SkipRecord      # Overlay + populate only
.\run_pipeline.ps1 -SkipOverlay     # Record + populate only
.\run_pipeline.ps1 -OverlayOnly     # Just overlay step
```

**Individual stages:**
```powershell
.\overlay_batch.ps1                 # Process any new recordings
.\overlay_batch.ps1 -Rows 61,65     # Specific rows
.\overlay_batch.ps1 -Force          # Re-do all, even existing
.\populate_aj.ps1                   # Refresh sheet col AJ from filesystem
```

---

## Today's Session Stats

**Completed:**
- 97 videos rendered end-to-end (98.4 MB total)
- All in `C:\Users\18473\Dropbox\Companies\1AltX\Tools\Video\out\`
- 69 rows in sheet have col AJ populated (28 orphans — videos rendered for rows since deleted from sheet)
- Render throughput: ~9 seconds per video, ~15 min for 97 videos batch

**Iterations Richard requested during build:**
1. Initial render at 320px → too small
2. Bumped to 640px → green halo visible
3. Added despill + 30fps upsample → clean, final spec

**Issues resolved:**
- Descript bridge cloudflared tunnel hang (killed and auto-restarted)
- BOM in JSON files breaking Go JSON parser (fixed with UTF-8 no-BOM writes)
- YouTube OAuth redirect_uri mismatch (port 80 vs 8080)
- Python not in LocalSystem PATH (installed system-wide to fix)

**Tangent abandoned:** YouTube Unlisted upload path — Richard uses Descript share URLs instead. YouTube scripts still in folder but unused.

---

## Known Limitations

1. **Recording is 2fps** — looks choppy on its own. Overlay step upsamples to 30fps via FFmpeg's fps filter, which smooths TH motion but not background.

2. **Cloudflare detection is fragile** — only checks for "just a moment" in page title. Any copy change on Cloudflare's side breaks the wait logic.

3. **Sequential only** — no parallelism. 97 rows = ~45 min of recording time + ~15 min of overlay time.

4. **No retry logic** — if a URL fails, row is skipped. Orphan `_frames_` folder may be left behind.

5. **Descript upload is manual** — Descript API supports upload but NOT publish/share URL generation. User must still click through Descript UI per video.

6. **Col V collision** — see "KNOWN ISSUE" above.

---

## Pending Work (open items for Forge or future Sonnet session)

1. **Fix col V collision** — decide canonical location for Descript URLs vs local filenames
2. **Test Descript API upload flow** — token validated, endpoint confirmed (`POST /v1/jobs/import/project_media`), but actual upload+project creation not yet scripted
3. **Clean up legacy YouTube files** — unused
4. **Delete 5 orphan YouTube test uploads** — IDs: 7QfMjy96nKA, W8cKq3ahxho, DxKlyGYBr6g, t63u9qER5Ic, 53FYyjlH2a0 (can't delete via API, wrong auth context — need manual cleanup via YouTube Studio)
5. **Optional rename** — Richard suggested "PVC" (Proposal Video Creator) as the project name. Could rename scripts to pvc_record.py, pvc_overlay.ps1, etc.
6. **Build Descript API uploader** — pending Richard's decision. Would use direct upload (signed URL) path. Token ready.

---

## Reference: Chrome Debug Launcher

Richard uses a "Chrome Debug" shortcut on desktop with target:
```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\ChromeDebug"
```

Opening that shortcut launches a separate Chrome profile that record_videos.py can connect to via CDP. Must be open and logged into UpWork before running pipeline.

---

## For Forge Reading This

The scripts are yours to own now. Key design principles I followed:
- **Resume-safe** — every stage skips work already done (file-exists checks)
- **Central config** — all paths/IDs in config.json, scripts load from there
- **Filesystem as source of truth** — populate_aj.ps1 scans output dir, doesn't trust hardcoded lookups (which go stale when sheet rows are deleted)
- **Stage-skippable** — run_pipeline.ps1 lets user skip any stage with flags

If you extend this, keep those patterns. If you rebuild it, consider:
- Moving to n8n workflow (Richard's stated long-term preference — we deferred because recording requires headed Chrome)
- Making record_videos.py multi-platform (not just UpWork — Cloudflare logic and column names are the only platform-specific parts)
- Adding retry logic on Cloudflare failures
