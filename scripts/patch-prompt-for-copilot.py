#!/usr/bin/env python3
"""
patch-prompt-for-copilot.py

Patches a Copilot Studio agent's `instructions` field (the GPT botcomponent
`data` YAML) by:

  1. Reading a markdown source file (e.g. docs/DAX-system-prompt-vNN.md),
     stripping the markdown header (everything up to and including the first
     `---` separator).
  2. Optionally prefixing a banner line (e.g. `[DEV — dev.dax.dakona.com]`).
  3. Escaping every literal `{` and `}` to `{{` and `}}` — Power Fx parses
     literal braces in instructions as record-literal expressions and fails
     publish validation with `ExpressionError / UnexpectedCharacter`.
     Discovered 2026-04-30 publishing v69 of the DAX prompt.
  4. PATCHing the botcomponent.data field via Dataverse Web API.

After PATCH succeeds, a manual Publish click in copilotstudio.microsoft.com
is required — the service-principal `PvaPublish` action is a no-op for
Dataverse-backed agents (Microsoft's UI publish endpoint is undocumented).

Auth: uses an `az account get-access-token` for the target Dataverse audience.
The signed-in identity must have Dataverse write on the bot solution.

Usage:
    python3 scripts/patch-prompt-for-copilot.py \\
        --source docs/DAX-system-prompt-v70.md \\
        --resource https://orgbe02eacf.api.crm.dynamics.com \\
        --component-id 8fc7b220-10e0-4978-8ed0-0d5c472cb4c9 \\
        --display-name Dax \\
        --model-hint GPT41 \\
        --dev-prefix "[DEV — dev.dax.dakona.com]"

Env vars (alternative to flags):
    DAX_RESOURCE, DAX_COMPONENT_ID, DAX_DISPLAY_NAME, DAX_DEV_PREFIX
"""

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request


def az_token(resource: str) -> str:
    out = subprocess.check_output(
        ["az", "account", "get-access-token", "--resource", resource, "--query", "accessToken", "-o", "tsv"]
    )
    return out.decode().strip()


def strip_markdown_header(src: str) -> str:
    parts = re.split(r"^---\s*$", src, maxsplit=1, flags=re.M)
    if len(parts) < 2:
        return src.strip()
    return parts[1].strip()


def escape_braces(text: str) -> str:
    return text.replace("{", "{{").replace("}", "}}")


def build_yaml(instructions: str, display_name: str, model_hint: str, web_browsing: bool, code_interpreter: bool) -> str:
    indented = "\n".join("  " + ln for ln in instructions.split("\n"))
    return (
        f"kind: GptComponentMetadata\n"
        f"displayName: {display_name}\n"
        f"instructions: |-\n"
        f"{indented}\n"
        f"gptCapabilities:\n"
        f"  webBrowsing: {str(web_browsing).lower()}\n"
        f"  codeInterpreter: {str(code_interpreter).lower()}\n"
        f"\n"
        f"aISettings:\n"
        f"  model:\n"
        f"    modelNameHint: {model_hint}\n"
        f"\n"
        f"  extensionData:\n"
        f"    lastUsedCustomModel: {{}}\n"
    )


def patch_botcomponent(resource: str, component_id: str, token: str, yaml_data: str) -> int:
    url = f"{resource}/api/data/v9.2/botcomponents({component_id})"
    body = json.dumps({"data": yaml_data}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="PATCH",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "OData-MaxVersion": "4.0",
            "OData-Version": "4.0",
            "If-Match": "*",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        print(f"PATCH failed: HTTP {e.code}: {e.read().decode()}", file=sys.stderr)
        return e.code


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source", required=True, help="Path to markdown source file")
    p.add_argument("--resource", default=os.getenv("DAX_RESOURCE"), help="Dataverse resource URL")
    p.add_argument("--component-id", default=os.getenv("DAX_COMPONENT_ID"), help="GPT botcomponent GUID")
    p.add_argument("--display-name", default=os.getenv("DAX_DISPLAY_NAME", "Dax"))
    p.add_argument("--model-hint", default="GPT41")
    p.add_argument("--web-browsing", action="store_true")
    p.add_argument("--code-interpreter", action="store_true")
    p.add_argument("--dev-prefix", default=os.getenv("DAX_DEV_PREFIX", ""), help="Optional banner prefix line")
    p.add_argument("--dry-run", action="store_true", help="Print payload, do not PATCH")
    args = p.parse_args()

    if not args.resource or not args.component_id:
        sys.exit("error: --resource and --component-id are required (or set DAX_RESOURCE / DAX_COMPONENT_ID)")

    src = open(args.source).read()
    body = strip_markdown_header(src)
    if args.dev_prefix:
        body = f"{args.dev_prefix}\n{body}"
    body_escaped = escape_braces(body)

    yaml_data = build_yaml(
        instructions=body_escaped,
        display_name=args.display_name,
        model_hint=args.model_hint,
        web_browsing=args.web_browsing,
        code_interpreter=args.code_interpreter,
    )

    print(f"prepared instructions: {len(body_escaped)} chars")
    print(f"brace pairs escaped: {body.count('{')} -> {body_escaped.count('{{')} (literal '{{' kept)")
    print(f"yaml total: {len(yaml_data)} bytes")

    if args.dry_run:
        print("--- YAML preview (first 30 lines) ---")
        print("\n".join(yaml_data.split("\n")[:30]))
        return

    token = az_token(args.resource)
    status = patch_botcomponent(args.resource, args.component_id, token, yaml_data)
    if 200 <= status < 300:
        print(f"PATCH ok ({status}). Now click Publish in Copilot Studio UI to make changes live.")
    else:
        sys.exit(f"PATCH failed: status={status}")


if __name__ == "__main__":
    main()
