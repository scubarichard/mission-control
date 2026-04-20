# Task Queue Conventions

Canonical format for tasks in `TASK_QUEUE.md`. Applies to all agents (Forge, Triton, Nautilus) and all coordinators (any Sonnet session, Richard directly).

## Why this matters

Multiple Claude sessions and Richard himself queue tasks to this file. Without conventions:
- Forge's poll logic gets confused by inconsistent status strings
- Audit trails become unreadable ("who queued what, when, why?")
- Task counters collide or skip
- Amendments get lost in free-form text no one re-reads

Follow the conventions even when they feel like overhead. Consistency is the product.

---

## Task ID format

```
TASK-YYYYMMDD-AGENT-PROJECT-NNN
```

| Component | Rule |
|---|---|
| `YYYYMMDD` | Date the task was **created**, not completed. Use UTC. |
| `AGENT` | `FORGE`, `TRITON`, `NAUTILUS`, `ATLAS` (uppercase) |
| `PROJECT` | Short uppercase code: `PNT`, `OPT`, `AUTOVID`, `RPE`, etc. |
| `NNN` | Monotonic counter, **scoped per agent per project**, zero-padded to 3 digits |

### Counter rule

Counter is **global per agent x project**, not reset daily. If the last task was `TASK-20260418-FORGE-AUTOVID-012`, the next one (whenever created) is `TASK-YYYYMMDD-FORGE-AUTOVID-013` with today's date.

**Why:** Forge's tooling matches `AUTOVID-013` etc. as unique refs. Resetting the counter per day would collide.

### Examples

- `TASK-20260420-FORGE-AUTOVID-017` - Forge task on AutoVid, task #17, queued April 20
- `TASK-20260420-TRITON-PNT-003` - Triton task on PNT, task #3, queued April 20

---

## Task status values

Use only these. No ad-hoc strings.

| Status | Meaning |
|---|---|
| `PENDING` | Ready for agent to pick up on next poll. No blockers. |
| `IN_PROGRESS` | Agent has started work. Agent sets this when they pick up. |
| `DONE` | Agent completed work. Awaiting review or merge. |
| `BLOCKED_BY_XXX` | Cannot start until TASK-XXX reaches DONE. Agent skips it. |
| `CANCELLED` | No longer needed. Include a reference to replacement task if applicable. |

**Do not invent new statuses.** (Past mistakes: `SUPERSEDED_BY_014`, `OPEN`. Use `CANCELLED` with a reference, or keep `PENDING`.)

### When superseding

1. Set old task''s status to `CANCELLED`
2. Add a `### [Sonnet] TASK-XXX CANCELLED YYYY-MM-DD (replaced by TASK-YYY)` section under the task block explaining why
3. New task references the old: `- **Replaces:** TASK-XXX`

### When unblocking

1. Flip status from `BLOCKED_BY_XXX` to `PENDING`
2. Add a `### [Sonnet] UNBLOCK YYYY-MM-DD HH:MM` note explaining what resolved the block

---

## Required task header fields

Every task starts with this block. Fields in order:

```markdown
## TASK-YYYYMMDD-AGENT-PROJECT-NNN
- **Assignee:** <agent name>
- **Status:** PENDING | IN_PROGRESS | DONE | BLOCKED_BY_XXX | CANCELLED
- **Priority:** High | Medium | Low
- **From:** [Sonnet] | [Richard] | [Triton]
- **Project:** <short description>
- **Repo:** `org/repo-name`
- **Branch:** <branch name or "create X from main">
```

Optional additional fields:
- `**PR:** #N` - if continuing work on an existing PR
- `**Replaces:** TASK-XXX` - if this cancels/replaces a prior task
- `**Depends on:** TASK-XXX` - explicit dependency (separate from status BLOCKED)
- `**Type:** Amendment | Bug fix | Feature | Infra` - only if meaningfully ambiguous

---

## Signature convention

Use single-word bracketed tags in the `From:` field and in commit messages.

| Source | Tag |
|---|---|
| Sonnet (any Claude.ai or API session coordinating) | `[Sonnet]` |
| Richard directly typing tasks | `[Richard]` |
| Forge self-reporting DONE/IN_PROGRESS | `[Forge]` |
| Triton, Nautilus, Atlas | `[Triton]`, `[Nautilus]`, `[Atlas]` |

Verbose variants like `Sonnet (Richard, autonomous mode)` or `Sonnet on behalf of Richard` are deprecated. They obscure who actually wrote the task.

**Why it matters:** When Forge self-identifies as `[Forge]` and Richard''s queued tasks are `[Richard]`, audit is trivial. When a Sonnet session signs `[Sonnet]`, everyone knows it''s AI coordination. When verbose signatures mix, no one can tell.

---

## Commit message convention

All mission-control commits that modify `TASK_QUEUE.md` start with a bracketed signer tag:

```
[Sonnet] Queue TASK-20260420-FORGE-AUTOVID-017: <short description>
[Sonnet] Unblock TASK-20260420-FORGE-AUTOVID-014
[Sonnet] Cancel TASK-20260420-FORGE-AUTOVID-013 (replaced by TASK-014)
[Forge] TASK-20260420-FORGE-AUTOVID-014 IN_PROGRESS
[Forge] TASK-20260420-FORGE-AUTOVID-014 DONE - PR#8
[Richard] Queue TASK-20260420-FORGE-PNT-014: urgent bug fix
```

First word inside the brackets = signer. Body = action.

---

## Task body structure

After the header block, follow this structure. Use exactly these section names in this order. Omit sections that don''t apply rather than renaming them.

```markdown
## TASK-...
- **Assignee:** ...
...

### Context
Why this task exists. What came before. Link to related tasks or PRs.

### Build
What to build. Specific modules, files, behaviors. Code sketches OK.

### Acceptance Criteria
Numbered list. What must be true for DONE.

### Out of Scope
What NOT to build. Bounds the work.

### Notes
Gotchas, prior knowledge, environment quirks.

### Questions / Blockers
Agent posts here if stuck.

### GATE RESULTS - [Agent] YYYY-MM-DD
Agent posts here when DONE. PR link, artifact paths, verification output.
```

---

## Amendments

If a task needs modification after being queued, prefer one of these, in order of preference:

1. **Edit in place** - modify the original task text directly. Best when no agent has started yet and the change is small. Commit with message `[Sonnet] Amend TASK-XXX: <what changed>`.

2. **Queue a new amendment task** - create a new `TASK-XXX+1` with `Type: Amendment` and `Modifies: TASK-XXX`. Best when agent may have already started, or change is substantial enough to audit separately.

3. **Append an UNBLOCK/CLARIFY note** - add a `### [Sonnet] CLARIFY YYYY-MM-DD` section after the task body. Use sparingly - this is the noisiest option.

**Avoid:** Free-form `### AMENDMENT` sections that aren''t numbered tasks. They get lost and agents don''t always re-read.

---

## Agent self-updates

Agents update task status themselves as they work:

| Transition | Who | When |
|---|---|---|
| `PENDING` -> `IN_PROGRESS` | Agent | When they pick up the task |
| `IN_PROGRESS` -> `DONE` | Agent | When acceptance criteria met and GATE RESULTS posted |
| `PENDING` -> `BLOCKED_BY_XXX` | Agent or coordinator | If blocker discovered during work |

Coordinators (Sonnet, Richard) handle:
- Initial queue -> `PENDING`
- `BLOCKED_BY_XXX` -> `PENDING` when unblocker lands
- `PENDING` -> `CANCELLED` when superseded or no longer needed
- Merge PR after gate review (optional - some PRs are agent-merged by convention)

---

## Quick checklist before queuing

Before committing a new task to `TASK_QUEUE.md`, verify:

- [ ] Task ID follows `TASK-YYYYMMDD-AGENT-PROJECT-NNN` format with today''s date
- [ ] Counter is monotonic (not resetting per day)
- [ ] Status is a canonical value from the table above
- [ ] `From:` is a single bracketed tag
- [ ] Required header fields all present
- [ ] Body follows standard section names
- [ ] Commit message starts with `[Signer]`
- [ ] If amending a prior task, using a formal amendment pattern (not free-form)

---

## History & changes

- **2026-04-20** - Initial conventions doc written by Sonnet after Richard flagged inconsistent task queuing patterns. Codifies practice that emerged organically over April 18-20.