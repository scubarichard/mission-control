#!/usr/bin/env python3
"""
deploy-dax-tool.py — deploy a DAX tool (Power Automate flow + Copilot Studio action) end-to-end.

Pattern discovered 2026-04-30:
  1. POST flow JSON to Microsoft.Flow API with state="Started" and `kind: "Skills"` for trigger/response.
     (Direct Dataverse `workflows` PATCH activation fails with DefinitionRequestMissingFields.
     Solution import imports flow but leaves it Stopped. Flow Management API w/ state=Started
     is the only programmatic activation path that works.)
  2. Wait for Dataverse sync of the workflow row (workflowidunique != flow API id, lookup by name).
  3. Add workflow to DAX solution (componenttype 29).
  4. Create action botcomponent in Dataverse (componenttype 9, kind:TaskDialog data).
  5. Associate botcomponent <-> workflow via N:N `botcomponent_workflow`.
  6. Add botcomponent to DAX solution (componenttype 10222).
  7. Manual UI Publish click on the bot — service-principal `PvaPublish` is a no-op.

Auth: uses az account get-access-token. Signed-in user must have flow maker rights
in the env (env creator does).

Usage:
  python3 scripts/deploy-dax-tool.py \\
      --tool-dir power-platform/flows/dax-tools/market-data \\
      --tool-name "Market Data" \\
      --action-schema-name MarketData

Required files in tool-dir:
  flow.json                — full flow definition with placeholders __FMP_API_KEY__ etc.
  botcomponent.data.yaml   — TaskDialog YAML; flowId placeholder replaced at deploy time
  secrets.json (optional)  — { "FMP_API_KEY": "kvname", ... } map of placeholder -> KV secret name

Limitations:
  - Bot publish is still a UI click (Microsoft.Flow runtime publish endpoint for
    Dataverse-backed bots is undocumented; SP/user PvaPublish returns 200 no-op).
  - Tools using M365 connectors (Outlook, Calendar, SharePoint) need connection refs
    and one-time user consent — not handled by this script yet.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request


def az_token(resource: str) -> str:
    out = subprocess.check_output(
        ["az", "account", "get-access-token", "--resource", resource, "--query", "accessToken", "-o", "tsv"]
    )
    return out.decode().strip()


def kv_secret(vault: str, name: str) -> str:
    out = subprocess.check_output(
        ["az", "keyvault", "secret", "show", "--vault-name", vault, "--name", name, "--query", "value", "-o", "tsv"],
        stderr=subprocess.DEVNULL,
    )
    return out.decode().strip()


def http(method: str, url: str, token: str, body=None, prefer_repr: bool = False):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json", "OData-MaxVersion": "4.0", "OData-Version": "4.0"}
    if prefer_repr:
        headers["Prefer"] = "return=representation"
    if body is not None:
        data = json.dumps(body).encode()
    else:
        data = None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode()
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--tool-dir", required=True)
    p.add_argument("--tool-name", required=True, help="Display name (e.g. 'Market Data')")
    p.add_argument("--action-schema-name", required=True, help="Schema suffix (e.g. 'MarketData' for auto_agent_BotRI.action.MarketData)")
    p.add_argument("--env-id", default="9481c72c-ad3f-eb02-823d-9ee8c5a09815")
    p.add_argument("--bot-id", default="389de172-2e44-f111-88b4-000d3a36c81b")
    p.add_argument("--bot-schema", default="auto_agent_BotRI")
    p.add_argument("--solution-name", default="DAX")
    p.add_argument("--dataverse-url", default="https://orgbe02eacf.api.crm.dynamics.com")
    p.add_argument("--key-vault", default="kvdaxdakonapilot")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    flow_path = os.path.join(args.tool_dir, "flow.json")
    botc_path = os.path.join(args.tool_dir, "botcomponent.data.yaml")
    secrets_path = os.path.join(args.tool_dir, "secrets.json")
    if not os.path.exists(flow_path) or not os.path.exists(botc_path):
        sys.exit(f"missing files: need {flow_path} and {botc_path}")

    flow_json = json.load(open(flow_path))
    flow_def = flow_json["properties"]["definition"]
    flow_def_str = json.dumps(flow_def)

    if os.path.exists(secrets_path):
        for placeholder, kv_name in json.load(open(secrets_path)).items():
            value = kv_secret(args.key_vault, kv_name)
            flow_def_str = flow_def_str.replace(f"__{placeholder}__", value)
    flow_def = json.loads(flow_def_str)

    flow_token = az_token("https://service.flow.microsoft.com")
    dv_token = az_token(args.dataverse_url)

    flow_create_body = {
        "properties": {
            "displayName": f"DAX — {args.tool_name}",
            "definition": flow_def,
            "state": "Started",
            "connectionReferences": flow_json["properties"].get("connectionReferences", {}),
        }
    }

    if args.dry_run:
        print(f"[dry-run] flow body: {len(json.dumps(flow_create_body))} bytes")
        print(json.dumps(flow_create_body, indent=2)[:1500])
        return

    print(f"[1/6] POST flow to Flow Management API ({args.tool_name})...")
    status, resp = http("POST", f"https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/{args.env_id}/flows?api-version=2016-11-01", flow_token, flow_create_body)
    if status != 201:
        sys.exit(f"flow create failed: {status} {json.dumps(resp)[:600]}")
    flow_api_id = resp["name"]
    print(f"     ✓ flow API id: {flow_api_id}")

    print(f"[2/6] wait for Dataverse sync...")
    workflow_id = None
    for attempt in range(15):
        time.sleep(3)
        from urllib.parse import quote
        flt = quote(f"name eq '{flow_create_body['properties']['displayName']}'")
        s, r = http("GET", f"{args.dataverse_url}/api/data/v9.2/workflows?$filter={flt}&$select=name,workflowid,statecode", dv_token)
        if s == 200 and r.get("value"):
            workflow_id = r["value"][0]["workflowid"]
            print(f"     ✓ Dataverse workflowid: {workflow_id} state={r['value'][0]['statecode']}")
            break
    if not workflow_id:
        sys.exit(f"Dataverse sync timed out after 45s")

    print(f"[3/6] add workflow to {args.solution_name} solution...")
    s, r = http("POST", f"{args.dataverse_url}/api/data/v9.2/AddSolutionComponent", dv_token, {"ComponentType": 29, "ComponentId": workflow_id, "SolutionUniqueName": args.solution_name, "AddRequiredComponents": False})
    print(f"     ✓ HTTP {s}")

    print(f"[4/6] create action botcomponent...")
    botc_data = open(botc_path).read().replace("__FLOW_ID__", workflow_id)
    body = {
        "name": args.tool_name,
        "schemaname": f"{args.bot_schema}.action.{args.action_schema_name}",
        "componenttype": 9,
        "data": botc_data,
        "parentbotid@odata.bind": f"/bots({args.bot_id})",
        "iscustomizable": {"Value": True, "CanBeChanged": True},
        "statecode": 0,
        "statuscode": 1,
    }
    s, r = http("POST", f"{args.dataverse_url}/api/data/v9.2/botcomponents", dv_token, body, prefer_repr=True)
    if s not in (200, 201):
        sys.exit(f"botcomponent create failed: {s} {json.dumps(r)[:500]}")
    bc_id = r["botcomponentid"]
    print(f"     ✓ botcomponentid: {bc_id}")

    print(f"[5/6] associate botcomponent <-> workflow...")
    s, r = http("POST", f"{args.dataverse_url}/api/data/v9.2/botcomponents({bc_id})/botcomponent_workflow/$ref", dv_token, {"@odata.id": f"{args.dataverse_url}/api/data/v9.2/workflows({workflow_id})"})
    print(f"     ✓ HTTP {s}")

    print(f"[6/6] add botcomponent to {args.solution_name} solution...")
    s, r = http("POST", f"{args.dataverse_url}/api/data/v9.2/AddSolutionComponent", dv_token, {"ComponentType": 10222, "ComponentId": bc_id, "SolutionUniqueName": args.solution_name, "AddRequiredComponents": False})
    print(f"     ✓ HTTP {s}")

    print()
    print(f"DONE. Tool 1 components in env. To make available in chat, click Publish in Copilot Studio UI.")
    print(f"  flow workflowid: {workflow_id}")
    print(f"  botcomponentid:  {bc_id}")


if __name__ == "__main__":
    main()
