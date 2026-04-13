#!/usr/bin/env python3
# Atlas Agent Loop - vm-dax-dev
# Polls TASK_QUEUE.md at :04 offset every 5 min
# Deploy: bash ~/mission-control/atlas/deploy.sh
import os, re, sys, time, json, logging, datetime, subprocess
import urllib.request

REPO_DIR = os.path.expanduser("~/mission-control")
TASK_QUEUE_PATH = os.path.join(REPO_DIR, "TASK_QUEUE.md")
POLL_OFFSET_SEC = 4 * 60
POLL_INTERVAL = 5 * 60
MORNING_HOUR = 8
INSTANTLY_API_KEY = os.environ.get("INSTANTLY_API_KEY", "")
SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN", "")
SLACK_CHANNEL = os.environ.get("SLACK_CHANNEL", "C0APVGG486M")
GIT_USER_EMAIL = os.environ.get("GIT_USER_EMAIL", "atlas@dakona.net")
GIT_USER_NAME = os.environ.get("GIT_USER_NAME", "Atlas")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [Atlas] %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout),
              logging.FileHandler(os.path.expanduser("~/atlas_agent.log"), encoding="utf-8")])
log = logging.getLogger("atlas")

def git(cmd):
    r = subprocess.run(["git"] + cmd.split(), cwd=REPO_DIR, capture_output=True, text=True)
    return r.returncode, r.stdout.strip(), r.stderr.strip()

def pull_queue():
    code, _, err = git("pull --rebase origin main")
    if code != 0: log.warning("git pull: " + err)

def push_queue(message):
    git("config user.email " + GIT_USER_EMAIL)
    git("config user.name " + GIT_USER_NAME)
    git("add TASK_QUEUE.md")
    code, out, _ = git("commit -m \"[Atlas] " + message + "\"")
    if "nothing to commit" in out: return True
    rc, _, err = git("push origin main")
    if rc != 0: log.error("git push failed: " + err)
    return rc == 0

def read_queue(): return open(TASK_QUEUE_PATH, encoding="utf-8").read()
def write_queue(c): open(TASK_QUEUE_PATH, "w", encoding="utf-8").write(c)

def find_pending_atlas_tasks(content):
    tasks = []
    for m in re.finditer(r"(## (TASK-\d{8}-ATLAS-\d+).*?)(?=\n## |\Z)", content, re.DOTALL):
        block, tid = m.group(1), m.group(2)
        if "Assignee:** Atlas" in block and "Status:** PENDING" in block:
            tasks.append((tid, block))
    return tasks

def mark_task(content, task_id, status, note=""):
    idx = content.find("## " + task_id)
    if idx == -1: return content
    end = content.find("\n## ", idx + 1)
    block = content[idx:end] if end != -1 else content[idx:]
    block = block.replace("Status:** PENDING", "Status:** " + status, 1)
    if note: block = block.rstrip() + "\n\n" + note + "\n"
    return content[:idx] + block + (content[end:] if end != -1 else "")

def self_assign(content, task_name, body, priority="High"):
    today = datetime.date.today().strftime("%Y%m%d")
    nums = [int(m) for m in re.findall("TASK-" + today + "-ATLAS-(\d+)", content)]
    tid = "TASK-" + today + "-ATLAS-" + str(max(nums, default=0)+1).zfill(3)
    block = "\n## " + tid + "\n- **Assignee:** Atlas\n- **Status:** PENDING\n"
    block += "- **Priority:** " + priority + "\n- **From:** Atlas (self-assigned)\n"
    block += "- **Task:** " + task_name + "\n\n" + body + "\n"
    return content + block, tid

def slack_post(text):
    if not SLACK_BOT_TOKEN: log.warning("No SLACK_BOT_TOKEN"); return
    payload = json.dumps({"channel": SLACK_CHANNEL, "text": text,
                           "username": "Atlas", "icon_emoji": ":robot_face:"}).encode()
    req = urllib.request.Request("https://slack.com/api/chat.postMessage", data=payload,
        headers={"Authorization": "Bearer " + SLACK_BOT_TOKEN, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            resp = json.loads(r.read())
            if not resp.get("ok"): log.error("Slack error: " + str(resp.get("error")))
    except Exception as e: log.error("Slack failed: " + str(e))

def instantly(path, method="GET", body=None):
    if not INSTANTLY_API_KEY: return None
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request("https://api.instantly.ai/api/v2/" + path, data=data,
        headers={"Authorization": "Bearer " + INSTANTLY_API_KEY, "Content-Type": "application/json"},
        method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r: return json.loads(r.read())
    except Exception as e:
        log.error("Instantly " + path + ": " + str(e)); return None

def get_campaign_stats():
    camps = instantly("campaigns?limit=20&status=1")
    if not camps: return []
    result = []
    for c in camps.get("items", []):
        a = instantly("campaigns/" + c["id"] + "/analytics") or {}
        result.append({"name": c.get("name","?"), "id": c["id"],
            "sent": a.get("emails_sent_count",0), "opens": a.get("open_count",0),
            "replies": a.get("reply_count",0), "interested": a.get("leads_who_replied_count",0),
            "active_leads": c.get("active_lead_count",0)})
    return result

def send_morning_brief():
    log.info("Sending morning brief to #dax-collab")
    stats = get_campaign_stats()
    today = datetime.date.today().strftime("%a %b %d")
    lines = ["[Atlas] :sunrise: *Morning Brief - " + today + "*"]
    if not stats:
        lines.append("Instantly stats unavailable.")
    else:
        for s in stats:
            lines.append("* " + s["name"] + ": " + str(s["sent"]) + " sent | " +
                str(s["opens"]) + " opens | " + str(s["replies"]) + " replies | " +
                str(s["interested"]) + " interested")
        low = [s for s in stats if s["active_leads"] < 50]
        if low: lines.append(":warning: Low leads (<50): " + ", ".join(s["name"] for s in low))
    slack_post("\n".join(lines))

def dispatch(task_id, block):
    b = block.lower()
    if "instantly stats" in b or "campaign stats" in b:
        stats = get_campaign_stats()
        if not stats: return "No Instantly stats available."
        r = "\n".join("- " + s["name"] + ": " + str(s["sent"]) + " sent / " + str(s["replies"]) + " replies" for s in stats)
        slack_post("[Atlas] Campaign stats:\n" + r); return r
    if "hot reply" in b or "interested reply" in b:
        r = instantly("emails/list?limit=10&reply_type=interested") or {}
        items = r.get("items", [])
        if not items: return "No interested replies found."
        lines = "\n".join("- " + i.get("from_address","?") + " - " + i.get("subject","")[:60] for i in items[:10])
        slack_post("[Atlas] :fire: " + str(len(items)) + " interested replies:\n" + lines)
        return lines
    if "lead top-up" in b or "apollo" in b:
        low = [s for s in get_campaign_stats() if s["active_leads"] < 50]
        if not low: return "All campaigns have adequate lead counts."
        msg = "Lead top-up needed: " + ", ".join(s["name"] + " (" + str(s["active_leads"]) + ")" for s in low)
        slack_post("[Atlas] :warning: " + msg); return msg
    return "No handler matched - manual review needed."

def run_monitoring_checks(content):
    changed = False
    for s in get_campaign_stats():
        if s["active_leads"] < 50:
            task_name = "Lead top-up: " + s["name"] + " (" + str(s["active_leads"]) + " leads)"
            if task_name not in content:
                body = "Campaign **" + s["name"] + "** has only " + str(s["active_leads"]) + " active leads.\nExport from Apollo, upload to Instantly. Threshold: <50."
                content, tid = self_assign(content, task_name, body)
                log.info("Self-assigned " + tid + ": " + task_name)
                changed = True
    return content, changed

def align_to_offset():
    now = time.time()
    window = now - (now % POLL_INTERVAL)
    target = window + POLL_OFFSET_SEC
    if target <= now: target += POLL_INTERVAL
    time.sleep(target - now)

def run():
    log.info("Atlas agent loop starting - polls :04 offset every 5 min")
    brief_date = None
    align_to_offset()
    while True:
        try:
            now = datetime.datetime.now()
            if now.hour == MORNING_HOUR and now.minute < 6 and brief_date != now.date():
                send_morning_brief()
                brief_date = now.date()
            pull_queue()
            content = read_queue()
            for task_id, block in find_pending_atlas_tasks(content):
                log.info("Executing " + task_id)
                content = mark_task(content, task_id, "IN_PROGRESS")
                write_queue(content); push_queue(task_id + ": IN_PROGRESS")
                pull_queue(); content = read_queue()
                result = dispatch(task_id, block)
                ts = now.strftime("%Y-%m-%d %H:%M")
                content = mark_task(content, task_id, "DONE", "**[Atlas] Completed " + ts + ":**\n" + result)
                write_queue(content); push_queue(task_id + ": DONE")
                pull_queue(); content = read_queue()
            content, changed = run_monitoring_checks(content)
            if changed:
                write_queue(content)
                push_queue("Self-assigned monitoring tasks")
        except Exception as e:
            log.error("Poll error: " + str(e), exc_info=True)
        align_to_offset()

if __name__ == "__main__":
    run()
