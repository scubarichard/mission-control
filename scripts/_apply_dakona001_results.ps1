$filePath = '/repo/dakona/dax/TASK_QUEUE.md'
$content = Get-Content $filePath -Raw -Encoding UTF8

# 1. Mark DAKONA-001 DONE
$content = $content -replace '(TASK-20260430-FORGE-DAKONA-001[^\n]*\n(?:[^\n]*\n)*?- \*\*Status:\*\* )IN_PROGRESS', '${1}DONE'

# 2. Build results block
$resultsBlock = @"

### Results

#### Phase 1 - Credentials located
**BLOCKER: `dakona-csp-scanner` SP was never created.** `New-DakonaScanSP.ps1` exists in the repo but has never been run.
- MCP container env vars: `AZURE_SP_TENANT_ID`, `AZURE_SP_CLIENT_ID`, `AZURE_SP_CLIENT_SECRET` - **all absent** from `ca-dax-mcp-dakona-pilot`
- KV `kvdaxdakonapilot`: no secret matching `scan`, `csp`, or `azure-sp`
- Repo: `AZURE_SP_CLIENT_ID` referenced in scripts but no stored credential anywhere
- **Action required:** Richard must run `New-DakonaScanSP.ps1` to create the SP + secret, then run `Set-ScannerEnvVars.ps1` to inject into the container

#### Phase 2 - SP membership
**Skipped - SP does not exist.** Cannot test auth until Phase 1 is resolved.

#### Phase 3 - Per-tenant access matrix (via rmabbun@dakona.com direct login)

| Client | TenantId | AVD HostPools | LA Workspaces | Verdict |
|---|---|---|---|---|
| The RIA Works | 2bc67e7e | 1 | 1 | Ready |
| Tidecrest Wealth Management | 6878179f | 1 | 1 | Ready |
| DAKONA 001 | d2a3c346 | 2 | 3 | Ready |
| Lopez and Company CPAs | 33f9ae74 | 1 | 0 | No LA workspace |
| Inflection Capital Management | 5a8c35a2 | 1 | 0 | No LA workspace |
| Uniting Wealth Partners | 6d3260f7 | 3 | 0 | No LA workspace |
| Impact Capital Partners | eaf1a864 | 0 | 1 | No AVD |
| MCPP Sub + 3x Azure subscription 1 | various | 0 | - | No AVD |

Note: Access verified via direct rmabbun@dakona.com user login, NOT via dakona-csp-scanner SP (which does not exist).

#### Phase 4 - Lighthouse inventory
`az managedservices assignment list` returns **0 delegations** for ALL 6 client subscriptions checked. No formal Lighthouse onboarding has been deployed. Current cross-tenant access is via direct user account (rmabbun@dakona.com), not ARM managed services delegation.

#### Recommended next steps
1. **Run `New-DakonaScanSP.ps1`** - creates `dakona-csp-scanner` app registration + SP + 2yr secret + Graph permissions
2. **Run `Set-ScannerEnvVars.ps1`** - injects `AZURE_SP_*` env vars into `ca-dax-mcp-dakona-pilot` container
3. **Create LA workspaces** in Lopez, Inflection, Uniting Wealth tenants (or exclude those 3 from disk monitor scope)
4. **Deploy Lighthouse** via `Deploy-Lighthouse.ps1` for client subs - currently zero delegations; SP needs Reader role on client subs for ARM + LA access
5. Re-run this preflight after Steps 1-4 to confirm SP auth + cross-tenant access before enabling Azure Automation runbook

"@

# Insert before the --- separator that precedes CHOSEN-004
$insertBefore = "---`n`n## TASK-20260429-CHOSEN-004"
$content = $content.Replace($insertBefore, $resultsBlock + $insertBefore)

Set-Content $filePath $content -Encoding UTF8 -NoNewline
Write-Host "Done. DAKONA-001 marked DONE + results inserted."
