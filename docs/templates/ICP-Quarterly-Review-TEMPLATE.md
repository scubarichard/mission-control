# ICP Quarterly Review Template — Field Reference

## Template

**File:** `DAX Templates/ICP-Quarterly-Review-TEMPLATE.docx`
**Location:** SharePoint document library, DAX Templates folder
**Workflow:** `n8n/workflows/document-generator.json` (Fill Placeholders node)
**Delimiter:** `{{ }}` (double curly braces, configured via docxtemplater)

## Webhook Endpoint

```
POST /webhook/generate-document
Content-Type: application/json
```

## Field Mapping (35 fields)

| Webhook Field | Template Placeholder | Example Value |
|---|---|---|
| `firmName` | `{{FIRM_NAME}}` | Dakona Wealth Advisors |
| `clientName` | `{{CLIENT_NAME}}` | John Smith |
| `reportPeriod` | `{{REPORT_PERIOD}}` | Q1 2026 |
| `reportDate` | `{{REPORT_DATE}}` | 2026-03-31 |
| `advisorName` | `{{ADVISOR_NAME}}` | Sarah Johnson |
| `accountNumber` | `{{ACCOUNT_NUMBER}}` | ICP-7842-A |
| `accountType` | `{{ACCOUNT_TYPE}}` | Taxable Brokerage |
| `riskProfile` | `{{RISK_PROFILE}}` | Moderate Growth |
| `meetingDate` | `{{MEETING_DATE}}` | 2026-04-05 |
| `meetingLocation` | `{{MEETING_LOCATION}}` | Conference Room B |
| `attendees` | `{{ATTENDEES}}` | John Smith, Sarah Johnson, Mike Chen |
| `meetingDuration` | `{{MEETING_DURATION}}` | 60 minutes |
| `discussionPoint1` | `{{DISCUSSION_POINT_1}}` | Portfolio rebalancing review |
| `discussionPoint2` | `{{DISCUSSION_POINT_2}}` | Tax-loss harvesting opportunities |
| `discussionPoint3` | `{{DISCUSSION_POINT_3}}` | Estate planning update |
| `advisorNotes` | `{{ADVISOR_NOTES}}` | Client expressed interest in increasing international exposure. |
| `portfolioValue` | `{{PORTFOLIO_VALUE}}` | $2,450,000 |
| `ytdReturn` | `{{YTD_RETURN}}` | 8.3% |
| `benchmarkReturn` | `{{BENCHMARK_RETURN}}` | 7.1% |
| `vsBenchmark` | `{{VS_BENCHMARK}}` | +1.2% |
| `goal1` | `{{GOAL_1}}` | Retirement by age 62 |
| `goal2` | `{{GOAL_2}}` | Education funding for two children |
| `goal3` | `{{GOAL_3}}` | Charitable giving strategy |
| `goalsProgressNotes` | `{{GOALS_PROGRESS_NOTES}}` | On track for all primary goals. |
| `action1` | `{{ACTION_1}}` | Rebalance international allocation |
| `action1Owner` | `{{ACTION_1_OWNER}}` | Sarah Johnson |
| `action1Due` | `{{ACTION_1_DUE}}` | 2026-04-15 |
| `action2` | `{{ACTION_2}}` | Review 529 plan contributions |
| `action2Owner` | `{{ACTION_2_OWNER}}` | Mike Chen |
| `action2Due` | `{{ACTION_2_DUE}}` | 2026-04-20 |
| `action3` | `{{ACTION_3}}` | Draft charitable trust proposal |
| `action3Owner` | `{{ACTION_3_OWNER}}` | Sarah Johnson |
| `action3Due` | `{{ACTION_3_DUE}}` | 2026-05-01 |
| `nextMeetingDate` | `{{NEXT_MEETING_DATE}}` | 2026-07-10 |
| `nextMeetingAgenda` | `{{NEXT_MEETING_AGENDA}}` | Mid-year review, tax planning |
